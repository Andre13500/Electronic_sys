using InformesTecnicos.Api.DTOs;
using InformesTecnicos.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace InformesTecnicos.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    public AuthController(IAuthService auth) => _auth = auth;

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest req)
    {
        var r = await _auth.LoginAsync(req);
        return r is null ? Unauthorized(new { error = "Credenciales inválidas" }) : Ok(r);
    }

    // Cambia la contraseña del usuario autenticado.
    // Si MustChangePassword era true, se pone en false y se retorna un nuevo token.
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        var userId = int.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? "0");
        if (req.PasswordNuevo.Length < 6)
            return BadRequest(new { error = "La contraseña debe tener al menos 6 caracteres." });

        var token = await _auth.ChangePasswordAsync(userId, req);
        return token is null
            ? BadRequest(new { error = "Contraseña actual incorrecta." })
            : Ok(new { token });
    }
}
