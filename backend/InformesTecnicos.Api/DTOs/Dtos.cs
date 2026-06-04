namespace InformesTecnicos.Api.DTOs;

// ===== AUTH =====
public record LoginRequest(string Email, string Password);
// MustChangePassword: si es true, el frontend redirige a cambio de contraseña obligatorio
public record LoginResponse(string Token, UsuarioDto Usuario, bool MustChangePassword);
public record ChangePasswordRequest(string PasswordActual, string PasswordNuevo);

// ===== USUARIOS (Admin) =====
public record UsuarioDto(int Id, string Nombre, string Email, string Rol);
public record UsuarioAdminDto(int Id, string Nombre, string Email, string Rol, bool Activo, bool MustChangePassword, DateTime CreadoEn);
// Al crear un usuario, el Admin elige nombre, email y rol; la contraseña se genera automáticamente
public record CrearUsuarioRequest(string Nombre, string Email, string Rol);
public record ResetPasswordResponse(string PasswordTemporal);

// ===== INFORMES =====
public record InformeListDto(
    int Id, string Codigo, string TecnicoNombre,
    string? ClienteNombre, string? ModeloProducto, string? NumeroSerie,
    string Estado, string TipoServicio, string? FormaPago, DateTime ActualizadoEn);

public record FotoDto(int Id, string Slot, string Url);

public record InformeDto(
    int Id, string Codigo, int TecnicoId, string TecnicoNombre,
    string TipoServicio,
    string? TallerNombre, string? TecnicoResponsable,
    string? OrdenServicio, string? NumeroSerie, string? ClienteNombre,
    string? LugarInstalacion, string? ModeloProducto, string? Observaciones,
    string? FormaPago,
    string Estado, DateTime CreadoEn, DateTime ActualizadoEn,
    List<FotoDto> Fotos);

// TipoServicio se establece al crear el informe y NO se cambia después
// Valores válidos: "washtower" | "refrigerador"
// Para agregar un nuevo tipo: ver Models.cs y ModuleSelector.jsx en el frontend
public record CrearInformeRequest(string TipoServicio);

public record GuardarInformeRequest(
    string? TallerNombre, string? TecnicoResponsable,
    string? OrdenServicio, string? NumeroSerie, string? ClienteNombre,
    string? LugarInstalacion, string? ModeloProducto, string? Observaciones,
    string? FormaPago);
