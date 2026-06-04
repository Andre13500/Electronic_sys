using InformesTecnicos.Api.Data;
using InformesTecnicos.Api.DTOs;
using InformesTecnicos.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace InformesTecnicos.Api.Services;

public interface IAdminService
{
    Task<List<UsuarioAdminDto>> ListarUsuariosAsync();
    Task<(UsuarioAdminDto usuario, string passwordTemporal)> CrearUsuarioAsync(CrearUsuarioRequest req);
    Task<ResetPasswordResponse> ResetPasswordAsync(int userId);
    Task<UsuarioAdminDto> ToggleActivoAsync(int userId, bool activo);
}

public class AdminService : IAdminService
{
    private readonly AppDbContext _db;
    public AdminService(AppDbContext db) => _db = db;

    public async Task<List<UsuarioAdminDto>> ListarUsuariosAsync() =>
        await _db.Usuarios
            .OrderBy(u => u.CreadoEn)
            .Select(u => new UsuarioAdminDto(
                u.Id, u.Nombre, u.Email, u.Rol,
                u.Activo, u.MustChangePassword, u.CreadoEn))
            .ToListAsync();

    // Crea un usuario con contraseña temporal generada automáticamente.
    // El usuario deberá cambiarla en su primer inicio de sesión.
    public async Task<(UsuarioAdminDto, string)> CrearUsuarioAsync(CrearUsuarioRequest req)
    {
        if (await _db.Usuarios.AnyAsync(u => u.Email == req.Email))
            throw new InvalidOperationException("Ya existe un usuario con ese email.");

        var passwordTemporal = GenerarPasswordTemporal();
        var usuario = new Usuario
        {
            Nombre = req.Nombre,
            Email = req.Email,
            Rol = req.Rol,
            PasswordHash = PasswordHasher.Hash(passwordTemporal),
            MustChangePassword = true // obliga al usuario a cambiar contraseña en primer login
        };
        _db.Usuarios.Add(usuario);
        await _db.SaveChangesAsync();

        var dto = new UsuarioAdminDto(
            usuario.Id, usuario.Nombre, usuario.Email, usuario.Rol,
            usuario.Activo, usuario.MustChangePassword, usuario.CreadoEn);
        return (dto, passwordTemporal);
    }

    // Restablece la contraseña a una temporal y marca al usuario para que la cambie.
    public async Task<ResetPasswordResponse> ResetPasswordAsync(int userId)
    {
        var u = await _db.Usuarios.FindAsync(userId)
            ?? throw new InvalidOperationException("Usuario no encontrado.");

        var passwordTemporal = GenerarPasswordTemporal();
        u.PasswordHash = PasswordHasher.Hash(passwordTemporal);
        u.MustChangePassword = true;
        await _db.SaveChangesAsync();

        return new ResetPasswordResponse(passwordTemporal);
    }

    public async Task<UsuarioAdminDto> ToggleActivoAsync(int userId, bool activo)
    {
        var u = await _db.Usuarios.FindAsync(userId)
            ?? throw new InvalidOperationException("Usuario no encontrado.");
        u.Activo = activo;
        await _db.SaveChangesAsync();
        return new UsuarioAdminDto(u.Id, u.Nombre, u.Email, u.Rol, u.Activo, u.MustChangePassword, u.CreadoEn);
    }

    // Genera una contraseña temporal de 10 caracteres: letras + números
    private static string GenerarPasswordTemporal()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
        var random = new Random();
        return new string(Enumerable.Range(0, 10).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }
}
