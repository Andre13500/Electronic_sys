using InformesTecnicos.Api.DTOs;
using InformesTecnicos.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InformesTecnicos.Api.Controllers;

// Todos los endpoints de este controlador son solo para Admin
[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    private readonly IAdminService _admin;
    public AdminController(IAdminService admin) => _admin = admin;

    // GET /api/admin/usuarios — lista todos los usuarios del sistema
    [HttpGet("usuarios")]
    public async Task<IActionResult> ListarUsuarios() =>
        Ok(await _admin.ListarUsuariosAsync());

    // POST /api/admin/usuarios — crea un nuevo usuario con contraseña temporal
    // La respuesta incluye la contraseña temporal para que el Admin la comunique al técnico
    [HttpPost("usuarios")]
    public async Task<IActionResult> CrearUsuario([FromBody] CrearUsuarioRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Nombre) || string.IsNullOrWhiteSpace(req.Email))
            return BadRequest(new { error = "Nombre y email son requeridos." });
        if (req.Rol != "Admin" && req.Rol != "Tecnico")
            return BadRequest(new { error = "Rol inválido. Use 'Admin' o 'Tecnico'." });

        try
        {
            var (usuario, password) = await _admin.CrearUsuarioAsync(req);
            return Ok(new { usuario, passwordTemporal = password });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // PUT /api/admin/usuarios/{id}/reset-password — restablece contraseña a una temporal
    // Marca al usuario con MustChangePassword = true
    [HttpPut("usuarios/{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id)
    {
        try { return Ok(await _admin.ResetPasswordAsync(id)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    // PUT /api/admin/usuarios/{id}/toggle-activo — activa o desactiva un usuario
    [HttpPut("usuarios/{id:int}/toggle-activo")]
    public async Task<IActionResult> ToggleActivo(int id, [FromBody] bool activo)
    {
        try { return Ok(await _admin.ToggleActivoAsync(id, activo)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
}
