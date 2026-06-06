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
    // Para agregar un nuevo módulo de servicio:
    //   1. Agrega el valor aquí (ej: "lavadora")
    //   2. En el frontend: ModuleSelector.jsx > array MODULES
    //   3. En el frontend: InformeEditor.jsx > objeto SLOTS_POR_TIPO
    // Valores actuales: "washtower" | "refrigerador"
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

    public ICollection<Foto> Fotos { get; set; } = new List<Foto>();
}

public class Foto
{
    public int Id { get; set; }
    public int InformeId { get; set; }
    public Informe Informe { get; set; } = null!;

    // Slots para WashTower: serie | accesorios | presion | alimentacion | nivelacion | equipo
    // Para agregar slots de un nuevo tipo de servicio, ver InformeService.cs > SlotsValidos
    [Required, MaxLength(30)] public string Slot { get; set; } = "";
    [Required, MaxLength(255)] public string NombreArchivo { get; set; } = "";
    [Required, MaxLength(500)] public string RutaRelativa { get; set; } = "";
    public DateTime SubidaEn { get; set; } = DateTime.UtcNow;
}
