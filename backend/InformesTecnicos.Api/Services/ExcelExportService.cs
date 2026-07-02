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
///
/// El servicio es GENÉRICO: no conoce ningún tipo de servicio en particular. Toda la
/// información específica de cada plantilla (celdas de campos y anclas de fotos) proviene
/// de <see cref="ITemplateConfigService"/> (archivos Templates/config/*.json). Para agregar
/// una plantilla nueva no se toca este archivo — ver TemplateConfigService.cs.
/// </summary>
public class ExcelExportService : IExcelExportService
{
    // Namespaces XML que usa el formato .xlsx internamente
    private static readonly XNamespace NsSS   = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static readonly XNamespace NsRels = "http://schemas.openxmlformats.org/package/2006/relationships";
    private static readonly XNamespace NsRel  = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static readonly XNamespace NsXdr  = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
    private static readonly XNamespace NsA    = "http://schemas.openxmlformats.org/drawingml/2006/main";
    private static readonly XNamespace NsCT   = "http://schemas.openxmlformats.org/package/2006/content-types";

    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<ExcelExportService> _log;
    private readonly ITemplateConfigService _config;

    public ExcelExportService(AppDbContext db, IWebHostEnvironment env,
        ILogger<ExcelExportService> log, ITemplateConfigService config)
    { _db = db; _env = env; _log = log; _config = config; }

    public async Task<(byte[] bytes, string fileName)> ExportarAsync(int informeId)
    {
        // 1. Cargar el informe con sus fotos y el técnico asociado
        var informe = await _db.Informes
            .Include(x => x.Tecnico)
            .Include(x => x.Fotos)
            .FirstOrDefaultAsync(x => x.Id == informeId)
            ?? throw new InvalidOperationException("Informe no encontrado.");

        // 2. Resolver la configuración del tipo de servicio (o fallback washtower)
        var cfg = _config.GetOrDefault(informe.TipoServicio);
        var templatePath = Path.Combine(_env.ContentRootPath, "Templates", cfg.Plantilla);

        if (!File.Exists(templatePath))
            throw new FileNotFoundException($"Plantilla no encontrada en: {templatePath}");

        // 3. Copiar la plantilla a memoria — operamos sobre el ZIP sin tocar el original
        var ms = new MemoryStream();
        using (var fs = File.OpenRead(templatePath))
            await fs.CopyToAsync(ms);

        // 4. Abrir el .xlsx como ZIP y modificar su contenido
        ms.Position = 0;
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Update, leaveOpen: true))
        {
            // Detectar automáticamente la hoja, el drawing y sus relaciones
            var (sheetPath, drawingPath, drawingRelsPath) = ResolveSheetPaths(zip);

            // Escribir los valores del informe en las celdas definidas por la configuración.
            // Se indexa por celda destino (ej: "B10" → valor) y se omiten los campos vacíos.
            var celdas = cfg.Campos
                .Where(kv => !string.IsNullOrEmpty(ValorCampo(informe, kv.Key)))
                .ToDictionary(kv => kv.Value, kv => ValorCampo(informe, kv.Key));
            WriteCellValues(zip, sheetPath, celdas);

            // Anclas de fotos: slot → (colIni, filaIni, colFin, filaFin)
            var anchors = cfg.Slots.ToDictionary(
                s => s.Key,
                s => (s.Anchor[0], s.Anchor[1], s.Anchor[2], s.Anchor[3]));

            // Insertar las fotos en las posiciones definidas por los anchors
            await EmbedPhotos(zip, drawingPath, drawingRelsPath, informe.Fotos, anchors);
        }

        // 5. Devolver el archivo generado con nombre basado en el código del informe
        var safe = informe.Codigo.Replace("/", "_");
        return (ms.ToArray(), $"{safe}.xlsx");
    }

    // Resuelve el valor de un campo del informe a partir del nombre usado en la config.
    private static string ValorCampo(Models.Informe i, string campo) => campo switch
    {
        "TallerNombre"        => i.TallerNombre        ?? "",
        "TecnicoResponsable"  => i.TecnicoResponsable  ?? "",
        "OrdenServicio"       => i.OrdenServicio        ?? "",
        "NumeroSerie"         => i.NumeroSerie          ?? "",
        "ClienteNombre"       => i.ClienteNombre        ?? "",
        "LugarInstalacion"    => i.LugarInstalacion     ?? "",
        "ModeloProducto"      => i.ModeloProducto       ?? "",
        "Observaciones"       => i.Observaciones        ?? "",
        _ => ""
    };

    // ───────────────────────────────────────────────────────────────────
    // Detecta automáticamente las rutas internas del .xlsx:
    // - La hoja de cálculo principal (busca "formulariofotografico")
    // - El archivo de drawing (donde van las imágenes)
    // - El archivo de relaciones del drawing
    // ───────────────────────────────────────────────────────────────────
    private static (string sheetPath, string drawingPath, string drawingRelsPath) ResolveSheetPaths(ZipArchive zip)
    {
        var wbDoc  = LoadXml(zip, "xl/workbook.xml");
        var wbRels = LoadXml(zip, "xl/_rels/workbook.xml.rels");

        // Busca la hoja por nombre normalizado (sin acentos ni espacios)
        var sheetEl = wbDoc.Descendants(NsSS + "sheet")
            .FirstOrDefault(s => NormName(s.Attribute("name")?.Value) == "formulariofotografico");

        // Si no la encuentra por nombre, usa la primera hoja visible
        sheetEl ??= wbDoc.Descendants(NsSS + "sheet")
            .FirstOrDefault(s => s.Attribute("state") == null);

        var sheetRId     = sheetEl?.Attribute(NsRel + "id")?.Value ?? "rId7";
        var sheetTarget  = wbRels.Descendants(NsRels + "Relationship")
            .FirstOrDefault(r => r.Attribute("Id")?.Value == sheetRId)
            ?.Attribute("Target")?.Value ?? "worksheets/sheet7.xml";
        var sheetPath    = "xl/" + sheetTarget.TrimStart('/');

        var sheetFile    = Path.GetFileName(sheetPath);
        var sheetRels    = LoadXml(zip, $"xl/worksheets/_rels/{sheetFile}.rels");

        // Busca la relación de tipo "drawing" (no vml) para encontrar el archivo de imágenes
        var drawingTarget = sheetRels.Descendants(NsRels + "Relationship")
            .FirstOrDefault(r =>
            {
                var t = r.Attribute("Type")?.Value ?? "";
                return t.Contains("/drawing") && !t.Contains("vml");
            })?.Attribute("Target")?.Value ?? "../drawings/drawing3.xml";

        var drawingPath     = "xl/" + drawingTarget.TrimStart('.').TrimStart('/');
        var drawingFile     = Path.GetFileName(drawingPath);
        var drawingRelsPath = $"xl/drawings/_rels/{drawingFile}.rels";

        return (sheetPath, drawingPath, drawingRelsPath);
    }

    // Normaliza el nombre de una hoja: minúsculas, sin acentos, sin espacios
    private static string NormName(string? n)
        => (n ?? "").ToLowerInvariant()
            .Replace("á","a").Replace("â","a").Replace("ã","a")
            .Replace("é","e").Replace("ê","e").Replace("í","i")
            .Replace("ó","o").Replace("ô","o").Replace("ú","u")
            .Replace("ç","c").Replace(" ","");

    // ───────────────────────────────────────────────────────────────────
    // Escribe valores de texto en celdas específicas del Excel.
    // Preserva el estilo (color, fuente, borde) que ya tiene la celda
    // en la plantilla. Si la fila o la celda no existen (plantillas donde
    // el campo está vacío), las crea en el orden correcto.
    // ───────────────────────────────────────────────────────────────────
    private static void WriteCellValues(ZipArchive zip, string sheetPath, Dictionary<string, string> values)
    {
        var doc       = LoadXml(zip, sheetPath);
        var sheetData = doc.Root!.Element(NsSS + "sheetData")!;

        foreach (var (cellRef, value) in values)
        {
            if (string.IsNullOrEmpty(value)) continue;

            var (colRef, rowNum) = SplitRef(cellRef);
            var row = GetOrCreateRow(sheetData, rowNum);
            var cell = GetOrCreateCell(row, cellRef, colRef);

            // Conservar el atributo de estilo "s" que define el formato visual
            var style = cell.Attribute("s")?.Value;
            cell.RemoveAll();
            if (style != null) cell.SetAttributeValue("s", style);
            cell.SetAttributeValue("r", cellRef);
            cell.SetAttributeValue("t", "inlineStr"); // tipo: string inline (no shared strings)
            cell.Add(new XElement(NsSS + "is", new XElement(NsSS + "t", value)));
        }

        SaveXml(zip, sheetPath, doc);
    }

    // Separa una referencia "B10" en ("B", 10)
    private static (string col, int row) SplitRef(string cellRef)
    {
        var col = string.Concat(cellRef.TakeWhile(char.IsLetter));
        var row = int.Parse(string.Concat(cellRef.SkipWhile(char.IsLetter)));
        return (col, row);
    }

    // Convierte "A"->1, "B"->2, ... "AA"->27 (para ordenar celdas dentro de la fila)
    private static int ColToIndex(string col)
    {
        int n = 0;
        foreach (var ch in col) n = n * 26 + (char.ToUpperInvariant(ch) - 'A' + 1);
        return n;
    }

    // Obtiene la fila indicada o la crea insertándola en orden ascendente por número de fila.
    private static XElement GetOrCreateRow(XElement sheetData, int rowNum)
    {
        var row = sheetData.Elements(NsSS + "row")
            .FirstOrDefault(r => r.Attribute("r")?.Value == rowNum.ToString());
        if (row != null) return row;

        row = new XElement(NsSS + "row", new XAttribute("r", rowNum.ToString()));
        var siguiente = sheetData.Elements(NsSS + "row")
            .FirstOrDefault(r => int.TryParse(r.Attribute("r")?.Value, out var n) && n > rowNum);
        if (siguiente != null) siguiente.AddBeforeSelf(row);
        else sheetData.Add(row);
        return row;
    }

    // Obtiene la celda indicada o la crea insertándola en orden ascendente por columna.
    private static XElement GetOrCreateCell(XElement row, string cellRef, string colRef)
    {
        var cell = row.Elements(NsSS + "c")
            .FirstOrDefault(c => c.Attribute("r")?.Value == cellRef);
        if (cell != null) return cell;

        cell = new XElement(NsSS + "c", new XAttribute("r", cellRef));
        var colIdx = ColToIndex(colRef);
        var siguiente = row.Elements(NsSS + "c").FirstOrDefault(c =>
        {
            var (col, _) = SplitRef(c.Attribute("r")?.Value ?? "A1");
            return ColToIndex(col) > colIdx;
        });
        if (siguiente != null) siguiente.AddBeforeSelf(cell);
        else row.Add(cell);
        return cell;
    }

    // ───────────────────────────────────────────────────────────────────
    // Inserta las fotos del informe dentro del archivo .xlsx.
    // Cada foto se copia a xl/media/, se registra en content types,
    // se enlaza en drawing.rels, y se posiciona con un anchor en el drawing.
    // ───────────────────────────────────────────────────────────────────
    private async Task EmbedPhotos(
        ZipArchive zip,
        string drawingPath,
        string drawingRelsPath,
        ICollection<Foto> fotos,
        Dictionary<string, (int fc, int fr, int tc, int tr)> slotAnchors)
    {
        // Solo procesar fotos que tienen un anchor definido para este tipo de servicio
        var relevant = fotos.Where(f => slotAnchors.ContainsKey(f.Slot)).ToList();
        if (!relevant.Any()) return;

        var drawingDoc = LoadXml(zip, drawingPath);
        var relsDoc    = LoadXml(zip, drawingRelsPath);

        // Calcular el próximo ID disponible para las relaciones (rId1, rId2, etc.)
        int nextId = relsDoc.Descendants(NsRels + "Relationship")
            .Select(r => int.TryParse(r.Attribute("Id")?.Value?.Replace("rId", ""), out var n) ? n : 0)
            .DefaultIfEmpty(0).Max() + 1;

        // Obtener extensiones de imagen ya registradas para no duplicar entradas
        var ctDoc          = LoadXml(zip, "[Content_Types].xml");
        var registeredExts = ctDoc.Descendants(NsCT + "Default")
            .Select(d => d.Attribute("Extension")?.Value?.ToLower())
            .Where(e => e != null).ToHashSet()!;

        foreach (var foto in relevant)
        {
            // Ruta física del archivo en el servidor
            var ruta = Path.Combine(_env.ContentRootPath, foto.RutaRelativa.TrimStart('/'));
            if (!File.Exists(ruta))
            {
                _log.LogWarning("Foto no encontrada en disco: {ruta}", ruta);
                continue;
            }

            var ext       = Path.GetExtension(foto.NombreArchivo).TrimStart('.').ToLower();
            var mediaName = $"photo_{foto.Slot}.{ext}";
            var mediaZip  = $"xl/media/{mediaName}"; // ruta dentro del ZIP del .xlsx

            // Copiar la imagen al interior del ZIP (reemplazar si ya existe)
            zip.GetEntry(mediaZip)?.Delete();
            var mediaEntry = zip.CreateEntry(mediaZip, CompressionLevel.Optimal);
            using (var src = File.OpenRead(ruta))
            using (var dst = mediaEntry.Open())
                await src.CopyToAsync(dst);

            // Registrar el tipo MIME de la extensión si no estaba ya declarado
            if (!registeredExts.Contains(ext))
            {
                var mime = ext == "png" ? "image/png" : "image/jpeg";
                ctDoc.Root!.Add(new XElement(NsCT + "Default",
                    new XAttribute("Extension", ext),
                    new XAttribute("ContentType", mime)));
                registeredExts.Add(ext);
            }

            var rId = $"rId{nextId}";

            // Crear la relación entre el drawing y el archivo de imagen
            relsDoc.Root!.Add(new XElement(NsRels + "Relationship",
                new XAttribute("Id", rId),
                new XAttribute("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"),
                new XAttribute("Target", $"../media/{mediaName}")));

            // Insertar el anchor que posiciona la imagen en la hoja
            var (fc, fr, tc, tr) = slotAnchors[foto.Slot];
            drawingDoc.Root!.Add(BuildAnchor(rId, nextId, foto.Slot, fc, fr, tc, tr));

            nextId++;
        }

        SaveXml(zip, drawingPath, drawingDoc);
        SaveXml(zip, drawingRelsPath, relsDoc);
        SaveXml(zip, "[Content_Types].xml", ctDoc);
    }

    // Construye el elemento XML que posiciona una imagen entre dos celdas en el drawing
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

    // Lee un archivo XML desde dentro del ZIP del .xlsx
    private static XDocument LoadXml(ZipArchive zip, string path)
    {
        var entry = zip.GetEntry(path)
            ?? throw new InvalidOperationException($"Entrada no encontrada en ZIP: {path}");
        using var stream = entry.Open();
        return XDocument.Load(stream);
    }

    // Guarda un archivo XML de vuelta dentro del ZIP (reemplaza el existente)
    private static void SaveXml(ZipArchive zip, string path, XDocument doc)
    {
        zip.GetEntry(path)?.Delete();
        using var stream = zip.CreateEntry(path, CompressionLevel.Optimal).Open();
        doc.Save(stream);
    }
}
