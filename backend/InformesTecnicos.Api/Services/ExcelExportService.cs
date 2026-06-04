using System.IO.Compression;
using System.Xml.Linq;
using InformesTecnicos.Api.Data;
using InformesTecnicos.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace InformesTecnicos.Api.Services;

public interface IExcelExportService
{
    Task<(byte[] bytes, string fileName)> ExportarAsync(int informeId);
}

/// <summary>
/// Opera directamente sobre el ZIP del .xlsx para preservar TODO el contenido de la plantilla,
/// incluyendo grupos de formas, imágenes de encabezado y cualquier elemento no soportado
/// por ClosedXML. Solo modifica las celdas de datos y añade las fotos del técnico.
/// </summary>
public class ExcelExportService : IExcelExportService
{
    // (fromCol, fromRow, toCol, toRow) — 0-based, extraídas del drawing3.xml original
    private static readonly Dictionary<string, (int fc, int fr, int tc, int tr)> SlotAnchors = new()
    {
        ["serie"]        = (0,  36, 5,  46),
        ["accesorios"]   = (6,  36, 9,  46),
        ["presion"]      = (10, 36, 14, 46),
        ["alimentacion"] = (1,  53, 5,  63),
        ["nivelacion"]   = (5,  52, 10, 63),
        ["equipo"]       = (11, 53, 14, 63),
    };

    private static readonly XNamespace NsSS    = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static readonly XNamespace NsRels  = "http://schemas.openxmlformats.org/package/2006/relationships";
    private static readonly XNamespace NsRel   = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static readonly XNamespace NsXdr   = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
    private static readonly XNamespace NsA     = "http://schemas.openxmlformats.org/drawingml/2006/main";
    private static readonly XNamespace NsCT    = "http://schemas.openxmlformats.org/package/2006/content-types";

    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<ExcelExportService> _log;

    public ExcelExportService(AppDbContext db, IWebHostEnvironment env, ILogger<ExcelExportService> log)
    { _db = db; _env = env; _log = log; }

    public async Task<(byte[] bytes, string fileName)> ExportarAsync(int informeId)
    {
        var informe = await _db.Informes
            .Include(x => x.Tecnico)
            .Include(x => x.Fotos)
            .FirstOrDefaultAsync(x => x.Id == informeId)
            ?? throw new InvalidOperationException("Informe no encontrado.");

        var templatePath = Path.Combine(_env.ContentRootPath, "Templates", "WashTower_Template.xlsx");
        if (!File.Exists(templatePath))
            throw new FileNotFoundException($"Plantilla no encontrada en: {templatePath}");

        // Copiar la plantilla byte a byte — operamos sobre el ZIP para preservar TODO
        var ms = new MemoryStream();
        using (var fs = File.OpenRead(templatePath))
            await fs.CopyToAsync(ms);

        ms.Position = 0;
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Update, leaveOpen: true))
        {
            var (sheetPath, drawingPath, drawingRelsPath) = ResolveSheetPaths(zip);

            WriteCellValues(zip, sheetPath, new Dictionary<string, string>
            {
                ["B10"] = informe.TallerNombre       ?? "",
                ["H10"] = informe.TecnicoResponsable  ?? "",
                ["B16"] = informe.OrdenServicio        ?? "",
                ["I16"] = informe.NumeroSerie          ?? "",
                ["B18"] = informe.ClienteNombre        ?? "",
                ["B20"] = informe.LugarInstalacion     ?? "",
                ["B22"] = informe.ModeloProducto       ?? "",
            });

            await EmbedPhotos(zip, drawingPath, drawingRelsPath, informe.Fotos);
        }

        var safe = informe.Codigo.Replace("/", "_");
        return (ms.ToArray(), $"{safe}.xlsx");
    }

    // ---------- resolución de rutas ----------

    private static (string sheetPath, string drawingPath, string drawingRelsPath) ResolveSheetPaths(ZipArchive zip)
    {
        var wbDoc  = LoadXml(zip, "xl/workbook.xml");
        var wbRels = LoadXml(zip, "xl/_rels/workbook.xml.rels");

        // Buscar la hoja "Formulário Fotográfico" normalizando acentos
        var sheetEl = wbDoc.Descendants(NsSS + "sheet")
            .FirstOrDefault(s => NormName(s.Attribute("name")?.Value) == "formulariofotografico");

        // Fallback: primera hoja sin state="veryHidden"
        sheetEl ??= wbDoc.Descendants(NsSS + "sheet")
            .FirstOrDefault(s => s.Attribute("state") == null);

        var sheetRId = sheetEl?.Attribute(NsRel + "id")?.Value ?? "rId7";

        var sheetTarget = wbRels.Descendants(NsRels + "Relationship")
            .FirstOrDefault(r => r.Attribute("Id")?.Value == sheetRId)
            ?.Attribute("Target")?.Value ?? "worksheets/sheet7.xml";
        var sheetPath = "xl/" + sheetTarget.TrimStart('/');

        var sheetFile     = Path.GetFileName(sheetPath);
        var sheetRelsPath = $"xl/worksheets/_rels/{sheetFile}.rels";
        var sheetRels     = LoadXml(zip, sheetRelsPath);

        var drawingTarget = sheetRels.Descendants(NsRels + "Relationship")
            .FirstOrDefault(r =>
            {
                var t = r.Attribute("Type")?.Value ?? "";
                return t.Contains("/drawing") && !t.Contains("vml");
            })?.Attribute("Target")?.Value ?? "../drawings/drawing3.xml";

        // drawingTarget es relativo a xl/worksheets/ → "../drawings/X" => "xl/drawings/X"
        var drawingPath     = "xl/" + drawingTarget.TrimStart('.').TrimStart('/');
        var drawingFile     = Path.GetFileName(drawingPath);
        var drawingRelsPath = $"xl/drawings/_rels/{drawingFile}.rels";

        return (sheetPath, drawingPath, drawingRelsPath);
    }

    private static string NormName(string? n)
        => (n ?? "").ToLowerInvariant()
            .Replace("á","a").Replace("â","a").Replace("ã","a")
            .Replace("é","e").Replace("ê","e").Replace("í","i")
            .Replace("ó","o").Replace("ô","o").Replace("ú","u")
            .Replace("ç","c").Replace(" ","");

    // ---------- escritura de celdas ----------

    private static void WriteCellValues(ZipArchive zip, string sheetPath, Dictionary<string, string> values)
    {
        var doc       = LoadXml(zip, sheetPath);
        var sheetData = doc.Root!.Element(NsSS + "sheetData")!;

        foreach (var (cellRef, value) in values)
        {
            if (string.IsNullOrEmpty(value)) continue;

            var rowNum = string.Concat(cellRef.SkipWhile(c => !char.IsDigit(c)));
            var row    = sheetData.Elements(NsSS + "row")
                             .FirstOrDefault(r => r.Attribute("r")?.Value == rowNum);
            if (row == null) continue;

            var cell = row.Elements(NsSS + "c")
                          .FirstOrDefault(c => c.Attribute("r")?.Value == cellRef);
            if (cell == null) continue;

            var style = cell.Attribute("s")?.Value;
            cell.RemoveAll();
            if (style != null) cell.SetAttributeValue("s", style);
            cell.SetAttributeValue("r", cellRef);
            cell.SetAttributeValue("t", "inlineStr");
            cell.Add(new XElement(NsSS + "is", new XElement(NsSS + "t", value)));
        }

        SaveXml(zip, sheetPath, doc);
    }

    // ---------- inserción de fotos ----------

    private async Task EmbedPhotos(ZipArchive zip, string drawingPath, string drawingRelsPath, ICollection<Foto> fotos)
    {
        var relevant = fotos.Where(f => SlotAnchors.ContainsKey(f.Slot)).ToList();
        if (!relevant.Any()) return;

        var drawingDoc = LoadXml(zip, drawingPath);
        var relsDoc    = LoadXml(zip, drawingRelsPath);

        int nextId = relsDoc.Descendants(NsRels + "Relationship")
            .Select(r => int.TryParse(r.Attribute("Id")?.Value?.Replace("rId", ""), out var n) ? n : 0)
            .DefaultIfEmpty(0).Max() + 1;

        // Registrar extensiones de imagen en [Content_Types].xml si faltan
        var ctDoc          = LoadXml(zip, "[Content_Types].xml");
        var registeredExts = ctDoc.Descendants(NsCT + "Default")
            .Select(d => d.Attribute("Extension")?.Value?.ToLower())
            .Where(e => e != null).ToHashSet()!;

        foreach (var foto in relevant)
        {
            var ruta = Path.Combine(_env.ContentRootPath, foto.RutaRelativa.TrimStart('/'));
            if (!File.Exists(ruta))
            {
                _log.LogWarning("Foto no encontrada en disco: {ruta}", ruta);
                continue;
            }

            var ext       = Path.GetExtension(foto.NombreArchivo).TrimStart('.').ToLower();
            var mediaName = $"photo_{foto.Slot}.{ext}";
            var mediaZip  = $"xl/media/{mediaName}";

            // Añadir (o reemplazar) imagen en el ZIP
            zip.GetEntry(mediaZip)?.Delete();
            var mediaEntry = zip.CreateEntry(mediaZip, CompressionLevel.Optimal);
            using (var src = File.OpenRead(ruta))
            using (var dst = mediaEntry.Open())
                await src.CopyToAsync(dst);

            // Registrar extensión de contenido si no está
            if (!registeredExts.Contains(ext))
            {
                var mime = ext == "png" ? "image/png" : "image/jpeg";
                ctDoc.Root!.Add(new XElement(NsCT + "Default",
                    new XAttribute("Extension", ext),
                    new XAttribute("ContentType", mime)));
                registeredExts.Add(ext);
            }

            var rId = $"rId{nextId}";

            // Relación imagen → archivo en drawing.rels
            relsDoc.Root!.Add(new XElement(NsRels + "Relationship",
                new XAttribute("Id", rId),
                new XAttribute("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"),
                new XAttribute("Target", $"../media/{mediaName}")));

            // Ancla de imagen en el drawing
            var (fc, fr, tc, tr) = SlotAnchors[foto.Slot];
            drawingDoc.Root!.Add(BuildAnchor(rId, nextId, foto.Slot, fc, fr, tc, tr));

            nextId++;
        }

        SaveXml(zip, drawingPath, drawingDoc);
        SaveXml(zip, drawingRelsPath, relsDoc);
        SaveXml(zip, "[Content_Types].xml", ctDoc);
    }

    private static XElement BuildAnchor(string rId, int picId, string slot, int fc, int fr, int tc, int tr) =>
        new(NsXdr + "twoCellAnchor",
            new XAttribute("editAs", "twoCell"),
            new XElement(NsXdr + "from",
                new XElement(NsXdr + "col", fc), new XElement(NsXdr + "colOff", 0),
                new XElement(NsXdr + "row", fr), new XElement(NsXdr + "rowOff", 0)),
            new XElement(NsXdr + "to",
                new XElement(NsXdr + "col", tc), new XElement(NsXdr + "colOff", 0),
                new XElement(NsXdr + "row", tr), new XElement(NsXdr + "rowOff", 0)),
            new XElement(NsXdr + "pic",
                new XElement(NsXdr + "nvPicPr",
                    new XElement(NsXdr + "cNvPr",
                        new XAttribute("id", picId + 200),
                        new XAttribute("name", $"photo_{slot}")),
                    new XElement(NsXdr + "cNvPicPr",
                        new XElement(NsA + "picLocks", new XAttribute("noChangeAspect", "1")))),
                new XElement(NsXdr + "blipFill",
                    new XElement(NsA + "blip", new XAttribute(NsRel + "embed", rId)),
                    new XElement(NsA + "stretch", new XElement(NsA + "fillRect"))),
                new XElement(NsXdr + "spPr",
                    new XElement(NsA + "xfrm",
                        new XElement(NsA + "off", new XAttribute("x", 0), new XAttribute("y", 0)),
                        new XElement(NsA + "ext", new XAttribute("cx", 1), new XAttribute("cy", 1))),
                    new XElement(NsA + "prstGeom", new XAttribute("prst", "rect"),
                        new XElement(NsA + "avLst")))),
            new XElement(NsXdr + "clientData"));

    // ---------- utilidades ZIP / XML ----------

    private static XDocument LoadXml(ZipArchive zip, string path)
    {
        var entry = zip.GetEntry(path)
            ?? throw new InvalidOperationException($"Entrada no encontrada en ZIP: {path}");
        using var stream = entry.Open();
        return XDocument.Load(stream);
    }

    private static void SaveXml(ZipArchive zip, string path, XDocument doc)
    {
        zip.GetEntry(path)?.Delete();
        using var stream = zip.CreateEntry(path, CompressionLevel.Optimal).Open();
        doc.Save(stream);
    }
}
