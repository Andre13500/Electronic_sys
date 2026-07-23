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
    private readonly ITemplateConfigService _config;

    public InformesController(IInformeService svc, IExcelExportService excel, IPdfExportService pdf,
        IWebHostEnvironment env, ITemplateConfigService config)
    { _svc = svc; _excel = excel; _pdf = pdf; _env = env; _config = config; }

    private int UsuarioId => int.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? "0");
    private string Rol    => User.FindFirstValue(ClaimTypes.Role) ?? "Tecnico";

    // Lista los módulos de servicio disponibles y sus fotos (slots), derivados de
    // las configuraciones Templates/config/*.json. El frontend construye con esto
    // el selector de módulos y las cuadrículas de fotos, sin listas hardcodeadas.
    [HttpGet("modulos")]
    public IActionResult Modulos()
    {
        var modulos = _config.Todas.Select(c => new ModuloDto(
            c.Tipo, c.Label, c.Descripcion, c.Icono, c.Imagen,
            c.Slots.Select(s => new SlotDto(s.Key, s.Label)).ToList()
        )).ToList();
        return Ok(modulos);
    }

    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery] string? q, [FromQuery] bool eliminados = false)
    {
        // Técnico solo ve los suyos; Admin ve todos.
        int? tecnicoId = Rol == "Tecnico" ? UsuarioId : null;
        // eliminados=true devuelve la papelera (informes con soft delete).
        return Ok(await _svc.ListarAsync(tecnicoId, q, soloEliminados: eliminados));
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

    private static readonly HashSet<string> _mimePermitidos = ["image/jpeg", "image/png", "image/webp"];
    private static readonly byte[][] _firmasImagenes =
    [
        [0xFF, 0xD8, 0xFF],           // JPEG
        [0x89, 0x50, 0x4E, 0x47],    // PNG
        [0x52, 0x49, 0x46, 0x46],    // WEBP (RIFF)
    ];

    private static bool EsImagenValida(IFormFile archivo)
    {
        if (!_mimePermitidos.Contains(archivo.ContentType.ToLowerInvariant())) return false;
        using var ms = new MemoryStream();
        archivo.OpenReadStream().CopyTo(ms);
        var header = ms.ToArray().Take(8).ToArray();
        return _firmasImagenes.Any(firma => header.Take(firma.Length).SequenceEqual(firma));
    }

    [HttpPost("{id:int}/fotos")]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> SubirFoto(int id, [FromForm] string slot, IFormFile archivo)
    {
        if (archivo is null || archivo.Length == 0) return BadRequest(new { error = "Archivo requerido" });
        if (!EsImagenValida(archivo)) return BadRequest(new { error = "Solo se permiten imágenes JPG, PNG o WEBP" });
        try { return Ok(await _svc.SubirFotoAsync(id, slot, archivo, _env)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpDelete("{id:int}/fotos/{fotoId:int}")]
    public async Task<IActionResult> EliminarFoto(int id, int fotoId)
    {
        try { await _svc.EliminarFotoAsync(id, fotoId, _env); return NoContent(); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    // Sirve una foto de forma AUTENTICADA (reemplaza el acceso público a /uploads).
    // Un Técnico solo ve fotos de sus informes; un Admin, cualquiera.
    [HttpGet("{id:int}/fotos/{fotoId:int}/imagen")]
    public async Task<IActionResult> VerFoto(int id, int fotoId)
    {
        try
        {
            var r = await _svc.ObtenerFotoArchivoAsync(id, fotoId, UsuarioId, Rol == "Admin", _env);
            if (r is null) return NotFound();
            // Caché privada en el navegador: evita re-descargar la misma foto en cada vista.
            Response.Headers.CacheControl = "private, max-age=86400";
            return PhysicalFile(r.Value.fullPath, r.Value.contentType);
        }
        catch (UnauthorizedAccessException ex) { return StatusCode(403, new { error = ex.Message }); }
    }

    [HttpPost("{id:int}/finalizar")]
    public async Task<IActionResult> Finalizar(int id)
    {
        try { return Ok(await _svc.FinalizarAsync(id)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    // Archiva un informe (borrado LÓGICO: no se borra de la BD, se oculta de la
    // lista y se puede restaurar). SOLO el Admin puede eliminar (los técnicos no).
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Eliminar(int id)
    {
        try
        {
            await _svc.EliminarAsync(id, UsuarioId, esAdmin: true, _env);
            return NoContent();
        }
        catch (UnauthorizedAccessException ex) { return StatusCode(403, new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return NotFound(new { error = ex.Message }); }
    }

    // Restaura un informe archivado (lo saca de la papelera). SOLO el Admin.
    [HttpPost("{id:int}/restaurar")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Restaurar(int id)
    {
        try
        {
            await _svc.RestaurarAsync(id, UsuarioId, esAdmin: true);
            return NoContent();
        }
        catch (UnauthorizedAccessException ex) { return StatusCode(403, new { error = ex.Message }); }
        catch (InvalidOperationException ex) { return NotFound(new { error = ex.Message }); }
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
