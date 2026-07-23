    using System.ComponentModel.DataAnnotations;

namespace InformesTecnicos.Api.Models;

public class Usuario
{
    public int Id { get; set; }
    [Required, MaxLength(120)] public string Nombre { get; set; } = "";
    [Required, MaxLength(120)] public string Email { get; set; } = "";
    [Required] public string PasswordHash { get; set; } = "";
    [Required, MaxLength(20)] public string Rol { get; set; } = "Tecnico"; // Admin | Tecnico
    public bool Activo { get; set; } = true;
    // true = el usuario debe cambiar su contraseña en el próximo inicio de sesión
    public bool MustChangePassword { get; set; } = false;
    public DateTime CreadoEn { get; set; } = DateTime.UtcNow;
}

public class Informe
{
    public int Id { get; set; }
    [Required, MaxLength(30)] public string Codigo { get; set; } = "";

    public int TecnicoId { get; set; }
    public Usuario Tecnico { get; set; } = null!;

    // ===== TIPO DE SERVICIO =====
    // Los tipos válidos son DINÁMICOS: cada uno se define en un archivo
    // Templates/config/{tipo}.json (ver Services/TemplateConfigService.cs).
    // Para agregar un módulo nuevo NO se toca código, solo se agrega el JSON
    // (y la plantilla .xlsx). Tipos actuales: washtower, refrigerador, wm,
    // dryer, estufas, rac, tv.
    [MaxLength(30)] public string TipoServicio { get; set; } = "washtower";

    // --- Datos del Taller ---
    [MaxLength(150)] public string? TallerNombre { get; set; }
    [MaxLength(150)] public string? TecnicoResponsable { get; set; }

    // --- Datos del Cliente ---
    [MaxLength(80)]  public string? OrdenServicio { get; set; }
    [MaxLength(80)]  public string? NumeroSerie { get; set; }
    [MaxLength(150)] public string? ClienteNombre { get; set; }
    [MaxLength(200)] public string? LugarInstalacion { get; set; }
    [MaxLength(100)] public string? ModeloProducto { get; set; }

    [MaxLength(2000)] public string? Observaciones { get; set; }

    // ===== FORMA DE PAGO =====
    // Solo se muestra en la web. NO se exporta a la plantilla Excel ni al PDF.
    // Valores: "efectivo" | "transferencia" | "free"
    [MaxLength(30)] public string? FormaPago { get; set; }

    [MaxLength(20)] public string Estado { get; set; } = "borrador"; // borrador | finalizado
    public DateTime CreadoEn { get; set; } = DateTime.UtcNow;
    public DateTime ActualizadoEn { get; set; } = DateTime.UtcNow;

    // ===== BORRADO LÓGICO (soft delete) =====
    // El informe NUNCA se elimina de la BD: se marca Eliminado=true y se oculta
    // de la lista. Sus fotos (fila y archivos en disco) se conservan para poder
    // restaurarlo. Ver InformeService.EliminarAsync / RestaurarAsync.
    public bool Eliminado { get; set; } = false;
    public DateTime? EliminadoEn { get; set; }

    public ICollection<Foto> Fotos { get; set; } = new List<Foto>();
}

public class Foto
{
    public int Id { get; set; }
    public int InformeId { get; set; }
    public Informe Informe { get; set; } = null!;

    // El nombre del slot depende del tipo de servicio del informe. Los slots
    // válidos de cada tipo se definen en Templates/config/{tipo}.json (campo
    // "slots") y se validan vía ITemplateConfigService.SlotValido.
    [Required, MaxLength(30)] public string Slot { get; set; } = "";
    [Required, MaxLength(255)] public string NombreArchivo { get; set; } = "";
    [Required, MaxLength(500)] public string RutaRelativa { get; set; } = "";
    public DateTime SubidaEn { get; set; } = DateTime.UtcNow;
}
