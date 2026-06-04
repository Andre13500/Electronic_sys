using InformesTecnicos.Api.Data;
using InformesTecnicos.Api.Models;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace InformesTecnicos.Api.Services;

public interface IPdfExportService
{
    Task<(byte[] bytes, string fileName)> ExportarAsync(int informeId);
}

/// <summary>
/// Replica el PDF oficial WashTower (logo LG + grilla 2x3 de fotos con etiquetas exactas).
/// </summary>
public class PdfExportService : IPdfExportService
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<PdfExportService> _log;

    private const string LG_RED = "#A50034";       // rojo oficial LG
    private const string TXT_LABEL = "#9B1B30";    // títulos de sección
    private const string BORDER = "#CCCCCC";

    public PdfExportService(AppDbContext db, IWebHostEnvironment env, ILogger<PdfExportService> log)
    { _db = db; _env = env; _log = log; }

    public async Task<(byte[] bytes, string fileName)> ExportarAsync(int informeId)
    {
        var i = await _db.Informes
            .Include(x => x.Tecnico)
            .Include(x => x.Fotos)
            .FirstOrDefaultAsync(x => x.Id == informeId)
            ?? throw new InvalidOperationException("Informe no encontrado.");

        Foto? Slot(string s) => i.Fotos.FirstOrDefault(f => f.Slot == s);

        // Extraer el logo LG desde la plantilla Excel (si existe)
        byte[]? logoBytes = TryExtractLogo();

        var doc = Document.Create(c =>
        {
            c.Page(p =>
            {
                p.Size(PageSizes.A4);
                p.Margin(30);
                p.DefaultTextStyle(x => x.FontFamily("Arial").FontSize(9).FontColor(Colors.Black));

                // ===== ENCABEZADO =====
                p.Header().PaddingBottom(8).Row(row =>
                {
                    row.ConstantItem(80).AlignMiddle().Element(box =>
                    {
                        if (logoBytes is not null)
                        {
                            try { box.Image(logoBytes).FitArea(); return; } catch { }
                        }
                        box.AlignCenter().AlignMiddle()
                           .Text("LG").FontSize(20).Bold().FontColor(LG_RED);
                    });
                    row.RelativeItem().AlignMiddle().PaddingLeft(20)
                        .Text("Informe de instalación - WashTower")
                        .FontSize(16).FontColor(LG_RED);
                });

                // ===== CONTENIDO =====
                p.Content().Column(col =>
                {
                    col.Spacing(10);

                    // --- Datos del Taller ---
                    col.Item().Element(c => Section(c, "Datos del Taller", inner =>
                    {
                        inner.Row(r =>
                        {
                            r.RelativeItem().Element(c => LabelInput(c, "Nombre", i.TallerNombre));
                            r.RelativeItem().Element(c => LabelInput(c, "Técnico Responsable", i.TecnicoResponsable));
                        });
                    }));

                    // --- Datos del Cliente ---
                    col.Item().Element(c => Section(c, "Datos del Cliente", inner =>
                    {
                        inner.Column(cc =>
                        {
                            cc.Spacing(6);
                            cc.Item().Row(r =>
                            {
                                r.RelativeItem().Element(c => LabelInput(c, "Orden de Servicio (RNN):", i.OrdenServicio));
                                r.RelativeItem().Element(c => LabelInput(c, "Número de Serie:", i.NumeroSerie));
                            });
                            cc.Item().Element(c => LabelInput(c, "Nombre del Cliente:", i.ClienteNombre));
                            cc.Item().Element(c => LabelInput(c, "Lugar de la Instalación:", i.LugarInstalacion));
                            cc.Item().Element(c => LabelInput(c, "Modelo del Producto:", i.ModeloProducto));
                        });
                    }));

                    // --- Fotos del Servicio (grilla 3 cols x 2 filas) ---
                    col.Item().Element(c => Section(c, "Fotos del Servicio", inner =>
                    {
                        inner.Column(g =>
                        {
                            g.Spacing(15);
                            g.Item().Row(r =>
                            {
                                r.Spacing(8);
                                r.RelativeItem().Element(c => PhotoCell(c, "Nº  Serie",                       Slot("serie")));
                                r.RelativeItem().Element(c => PhotoCell(c, "Accesorios (Manguera + Llave)",   Slot("accesorios")));
                                r.RelativeItem().Element(c => PhotoCell(c, "Presión de Agua\n(0,5 ~ 8,0 kgf/cm²)", Slot("presion")));
                            });
                            g.Item().Row(r =>
                            {
                                r.Spacing(8);
                                r.RelativeItem().Element(c => PhotoCell(c, "Alimentación Eléctrica (220 V)", Slot("alimentacion")));
                                r.RelativeItem().Element(c => PhotoCell(c, "Nivelación",                     Slot("nivelacion")));
                                r.RelativeItem().Element(c => PhotoCell(c, "Foto del Equipo Instalado",     Slot("equipo")));
                            });
                        });
                    }));

                    // --- Observaciones (opcional, solo si hay) ---
                    if (!string.IsNullOrWhiteSpace(i.Observaciones))
                    {
                        col.Item().Element(c => Section(c, "Observaciones", inner =>
                            inner.Text(i.Observaciones).FontSize(9)));
                    }
                });

                p.Footer().AlignCenter().Text(t =>
                {
                    t.Span($"{i.Codigo}   ·   ").FontSize(7).FontColor(Colors.Grey.Medium);
                    t.Span($"{DateTime.Now:dd/MM/yyyy HH:mm}").FontSize(7).FontColor(Colors.Grey.Medium);
                });
            });
        });

        var safe = i.Codigo.Replace("/", "_");
        return (doc.GeneratePdf(), $"{safe}.pdf");
    }

    private byte[]? TryExtractLogo()
    {
        try
        {
            var templatePath = Path.Combine(_env.ContentRootPath, "Templates", "WashTower_Template.xlsx");
            if (!File.Exists(templatePath)) return null;
            using var wb = new ClosedXML.Excel.XLWorkbook(templatePath);
            if (!wb.TryGetWorksheet("Formulário Fotográfico", out var ws)) return null;
            var first = ws.Pictures.FirstOrDefault();
            if (first is null) return null;
            using var ms = new MemoryStream();
            first.ImageStream.Position = 0;
            first.ImageStream.CopyTo(ms);
            return ms.ToArray();
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "No se pudo extraer logo");
            return null;
        }
    }

    // --- Helpers de layout ---

    private static void Section(IContainer container, string titulo, Action<IContainer> contenido)
    {
        container.Border(0.7f).BorderColor(BORDER).Padding(10).Column(c =>
        {
            c.Item().PaddingBottom(8).Text(titulo).FontColor(TXT_LABEL).Bold().FontSize(11);
            c.Item().Element(contenido);
        });
    }

    private static void LabelInput(IContainer container, string etiqueta, string? valor)
    {
        container.Column(c =>
        {
            c.Item().Text(etiqueta).FontSize(9).FontColor(TXT_LABEL);
            c.Item().PaddingTop(2).Border(0.7f).BorderColor(BORDER).MinHeight(18).Padding(3)
                .Text(valor ?? "").FontSize(9);
        });
    }

    private void PhotoCell(IContainer container, string etiqueta, Foto? foto)
    {
        container.Column(c =>
        {
            c.Item().AlignCenter().Text(etiqueta).FontSize(8).FontColor(TXT_LABEL);
            c.Item().PaddingTop(4).Border(0.7f).BorderColor(BORDER).Height(130)
                .AlignCenter().AlignMiddle().Element(box =>
                {
                    if (foto is null) { box.Text("").FontSize(7).FontColor(Colors.Grey.Lighten1); return; }
                    var ruta = Path.Combine(_env.ContentRootPath, foto.RutaRelativa.TrimStart('/'));
                    if (!File.Exists(ruta)) { box.Text("(no disponible)").FontSize(7); return; }
                    try { box.Image(ruta).FitArea(); }
                    catch (Exception ex) { _log.LogWarning(ex, "Error cargando foto {r}", ruta); box.Text("(error)").FontSize(7); }
                });
        });
    }
}
