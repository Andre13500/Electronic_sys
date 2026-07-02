using System.Text.Json;
using System.Text.Json.Serialization;

namespace InformesTecnicos.Api.Services;

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE PLANTILLAS (Opción escalable — JSON + procesador genérico)
//
// Cada tipo de servicio se describe en un archivo JSON dentro de
//   Templates/config/{tipo}.json
//
// El JSON define:
//   - qué plantilla .xlsx usar
//   - a qué celda va cada campo del informe (campos)
//   - qué fotos existen, su etiqueta y dónde se anclan en el Excel (slots)
//
// Para AGREGAR UN NUEVO MÓDULO no se toca código:
//   1. Coloca la plantilla .xlsx en Templates/
//   2. Crea Templates/config/{tipo}.json copiando uno existente
//   3. Ajusta celdas (campos) y anclas de fotos (slots)
//   4. (Opcional) agrega una imagen en frontend/img y referénciala en "imagen"
// ═══════════════════════════════════════════════════════════════════════

/// <summary>Configuración completa de un tipo de servicio (una plantilla).</summary>
public class TemplateConfig
{
    public string Tipo { get; set; } = "";
    public string Label { get; set; } = "";
    public string Descripcion { get; set; } = "";
    public string Icono { get; set; } = "";
    public string Imagen { get; set; } = "";
    public string Plantilla { get; set; } = "";

    /// <summary>Campo del informe → referencia de celda (ej: "TallerNombre" → "B10").</summary>
    public Dictionary<string, string> Campos { get; set; } = new();

    /// <summary>Fotos del servicio: key, etiqueta y ancla [colIni, filaIni, colFin, filaFin] (base 0).</summary>
    public List<SlotConfig> Slots { get; set; } = new();
}

public class SlotConfig
{
    public string Key { get; set; } = "";
    public string Label { get; set; } = "";
    /// <summary>[colInicio, filaInicio, colFin, filaFin] en base 0.</summary>
    public int[] Anchor { get; set; } = new int[4];
}

public interface ITemplateConfigService
{
    /// <summary>Todas las configuraciones registradas, en orden de carga.</summary>
    IReadOnlyList<TemplateConfig> Todas { get; }
    /// <summary>Configuración de un tipo; null si no existe.</summary>
    TemplateConfig? Get(string? tipo);
    /// <summary>Configuración de un tipo o la de fallback (washtower) si no existe.</summary>
    TemplateConfig GetOrDefault(string? tipo);
    /// <summary>True si el slot es válido para el tipo indicado.</summary>
    bool SlotValido(string? tipo, string slot);
}

/// <summary>
/// Carga y cachea en memoria todas las configuraciones de plantilla al iniciar.
/// Las lee desde Templates/config/*.json (se copian al directorio de salida).
/// </summary>
public class TemplateConfigService : ITemplateConfigService
{
    private readonly Dictionary<string, TemplateConfig> _porTipo = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<TemplateConfig> _orden = new();
    private readonly ILogger<TemplateConfigService> _log;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
        Converters = { new JsonStringEnumConverter() }
    };

    public TemplateConfigService(IWebHostEnvironment env, ILogger<TemplateConfigService> log)
    {
        _log = log;
        var dir = Path.Combine(env.ContentRootPath, "Templates", "config");
        if (!Directory.Exists(dir))
        {
            _log.LogWarning("Carpeta de configuración de plantillas no encontrada: {dir}", dir);
            return;
        }

        // Orden de presentación deseado en el frontend. Los no listados van al final.
        var ordenPreferido = new[] { "washtower", "refrigerador", "wm", "dryer", "estufas", "rac", "tv" };

        var archivos = Directory.GetFiles(dir, "*.json")
            .OrderBy(f =>
            {
                var name = Path.GetFileNameWithoutExtension(f).ToLowerInvariant();
                var idx = Array.IndexOf(ordenPreferido, name);
                return idx < 0 ? int.MaxValue : idx;
            })
            .ThenBy(Path.GetFileName);

        foreach (var file in archivos)
        {
            try
            {
                var cfg = JsonSerializer.Deserialize<TemplateConfig>(File.ReadAllText(file), JsonOpts);
                if (cfg is null || string.IsNullOrWhiteSpace(cfg.Tipo))
                {
                    _log.LogWarning("Configuración inválida (sin tipo): {file}", file);
                    continue;
                }
                _porTipo[cfg.Tipo] = cfg;
                _orden.Add(cfg);
                _log.LogInformation("Plantilla cargada: {tipo} → {plantilla} ({n} slots)",
                    cfg.Tipo, cfg.Plantilla, cfg.Slots.Count);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Error al cargar configuración de plantilla: {file}", file);
            }
        }
    }

    public IReadOnlyList<TemplateConfig> Todas => _orden;

    public TemplateConfig? Get(string? tipo)
        => tipo is not null && _porTipo.TryGetValue(tipo, out var c) ? c : null;

    public TemplateConfig GetOrDefault(string? tipo)
        => Get(tipo) ?? Get("washtower") ?? _orden.FirstOrDefault()
           ?? throw new InvalidOperationException("No hay ninguna configuración de plantilla cargada.");

    public bool SlotValido(string? tipo, string slot)
    {
        var cfg = Get(tipo);
        return cfg is not null && cfg.Slots.Any(s => s.Key == slot);
    }
}
