using InformesTecnicos.Api.Data;
using InformesTecnicos.Api.DTOs;
using InformesTecnicos.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace InformesTecnicos.Api.Services;

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(LoginRequest req);
    Task<string?> ChangePasswordAsync(int userId, ChangePasswordRequest req);
    Task<PerfilDto?> GetPerfilAsync(int userId);
}

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _cfg;
    public AuthService(AppDbContext db, IConfiguration cfg) { _db = db; _cfg = cfg; }

    public async Task<LoginResponse?> LoginAsync(LoginRequest req)
    {
        var u = await _db.Usuarios.FirstOrDefaultAsync(x => x.Email == req.Email && x.Activo);
        if (u is null || !PasswordHasher.Verify(req.Password, u.PasswordHash)) return null;

        var token = GenerarToken(u);
        return new LoginResponse(
            token,
            new UsuarioDto(u.Id, u.Nombre, u.Email, u.Rol),
            u.MustChangePassword);
    }

    // Cambia la contraseña del usuario autenticado.
    // Retorna null si el password actual es incorrecto.
    public async Task<string?> ChangePasswordAsync(int userId, ChangePasswordRequest req)
    {
        var u = await _db.Usuarios.FindAsync(userId);
        if (u is null || !PasswordHasher.Verify(req.PasswordActual, u.PasswordHash))
            return null;

        u.PasswordHash = PasswordHasher.Hash(req.PasswordNuevo);
        u.MustChangePassword = false;
        await _db.SaveChangesAsync();

        return GenerarToken(u);
    }

    // Devuelve los datos del perfil del usuario autenticado.
    // Solo expone datos públicos del perfil; nunca el hash de la contraseña.
    public async Task<PerfilDto?> GetPerfilAsync(int userId)
    {
        var u = await _db.Usuarios.FindAsync(userId);
        if (u is null) return null;
        return new PerfilDto(u.Id, u.Nombre, u.Email, u.Rol, u.CreadoEn);
    }

    private string GenerarToken(Usuario u)
    {
        var key = _cfg["Jwt:Key"]!;
        var minutes = int.Parse(_cfg["Jwt:ExpiresMinutes"] ?? "480");
        var creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _cfg["Jwt:Issuer"],
            audience: _cfg["Jwt:Audience"],
            claims: new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, u.Id.ToString()),
                new Claim(ClaimTypes.Name, u.Nombre),
                new Claim(ClaimTypes.Role, u.Rol)
            },
            expires: DateTime.UtcNow.AddMinutes(minutes),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public static class PasswordHasher
{
    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
        return $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(key)}";
    }
    public static bool Verify(string password, string stored)
    {
        var parts = stored.Split('.');
        if (parts.Length != 2) return false;
        var salt = Convert.FromBase64String(parts[0]);
        var key = Convert.FromBase64String(parts[1]);
        var test = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, key.Length);
        return CryptographicOperations.FixedTimeEquals(key, test);
    }
}
