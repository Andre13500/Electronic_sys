using InformesTecnicos.Api.DTOs;
using InformesTecnicos.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace InformesTecnicos.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/informes")]
public class InformesController : ControllerBase
{
    private readonly IInformeService _svc;
    private readonly IExcelExportService _excel;
    private readonly IPdfExportService _pdf;
    private readonly IWebHostEnvironment _env;

    public InformesController(IInformeService svc, IExcelExportService excel, IPdfExportService pdf, IWebHostEnvironment env)
    { _svc = svc; _excel = excel; _pdf = pdf; _env = env; }

    private int UsuarioId => int.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? "0");
    private string Rol    => User.FindFirstValue(ClaimTypes.Role) ?? "Tecnico";

    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery] string? q)
    {
        // Técnico solo ve los suyos; Admin ve todos.
        int? tecnicoId = Rol == "Tecnico" ? UsuarioId : null;
        return Ok(await _svc.ListarAsync(tecnicoId, q));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Obtener(int id)
    {
        var inf = await _svc.ObtenerAsync(id);
        return inf is null ? NotFound() : Ok(inf);
    }

    // Crea un informe del tipo especificado (washtower | refrigerador)
    // Para agregar un nuevo tipo de servicio: ver Models.cs > TipoServicio y ModuleSelector.jsx
    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearInformeRequest req)
    {
        try { return Ok(await _svc.CrearAsync(UsuarioId, req.TipoServicio)); }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Guardar(int id, [FromBody] GuardarInformeRequest req)
    {
        try { return Ok(await _svc.GuardarAsync(id, req)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("{id:int}/fotos")]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> SubirFoto(int id, [FromForm] string slot, IFormFile archivo)
    {
        if (archivo is null || archivo.Length == 0) return BadRequest(new { error = "Archivo requerido" });
        try { return Ok(await _svc.SubirFotoAsync(id, slot, archivo, _env)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpDelete("{id:int}/fotos/{fotoId:int}")]
    public async Task<IActionResult> EliminarFoto(int id, int fotoId)
    {
        try { await _svc.EliminarFotoAsync(id, fotoId, _env); return NoContent(); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("{id:int}/finalizar")]
    public async Task<IActionResult> Finalizar(int id)
    {
        try { return Ok(await _svc.FinalizarAsync(id)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("{id:int}/exportar/excel")]
    public async Task<IActionResult> ExportarExcel(int id)
    {
        try
        {
            var (bytes, name) = await _excel.ExportarAsync(id);
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name);
        }
        catch (Exception ex) { return BadRequest(new { error = ex.GetType().Name + ": " + ex.Message }); }
    }

    [HttpGet("{id:int}/exportar/pdf")]
    public async Task<IActionResult> ExportarPdf(int id)
    {
        try
        {
            var (bytes, name) = await _pdf.ExportarAsync(id);
            return File(bytes, "application/pdf", name);
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
}
