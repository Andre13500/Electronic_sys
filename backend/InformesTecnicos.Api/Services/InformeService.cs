using InformesTecnicos.Api.Data;
using InformesTecnicos.Api.DTOs;
using InformesTecnicos.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace InformesTecnicos.Api.Services;

public interface IInformeService
{
    Task<InformeDto> CrearAsync(int tecnicoId, string tipoServicio);
    Task<InformeDto?> ObtenerAsync(int id);
    Task<List<InformeListDto>> ListarAsync(int? tecnicoId, string? q, bool soloEliminados = false);
    Task<InformeDto> GuardarAsync(int id, GuardarInformeRequest req);
    Task<FotoDto> SubirFotoAsync(int id, string slot, IFormFile archivo, IWebHostEnvironment env);
    Task EliminarFotoAsync(int id, int fotoId, IWebHostEnvironment env);
    Task<InformeDto> FinalizarAsync(int id);
    Task EliminarAsync(int id, int solicitanteId, bool esAdmin, IWebHostEnvironment env);
    Task RestaurarAsync(int id, int solicitanteId, bool esAdmin);
    Task<(string fullPath, string contentType)?> ObtenerFotoArchivoAsync(
        int informeId, int fotoId, int solicitanteId, bool esAdmin, IWebHostEnvironment env);
}

public class InformeService : IInformeService
{
    // Los slots válidos ya NO se listan aquí: cada tipo de servicio declara sus
    // slots en Templates/config/{tipo}.json y se validan vía ITemplateConfigService.
    // Para agregar un módulo nuevo no se toca este archivo — ver TemplateConfigService.cs.

    // Nombre del taller por defecto (pre-llenado al crear informe)
    // Cambia este valor si el nombre del taller cambia
    private const string TallerPorDefecto = "Electronic Shop";

    private readonly AppDbContext _db;
    private readonly ITemplateConfigService _config;
    public InformeService(AppDbContext db, ITemplateConfigService config)
    { _db = db; _config = config; }

    public async Task<InformeDto> CrearAsync(int tecnicoId, string tipoServicio)
    {
        var tecnico = await _db.Usuarios.FindAsync(tecnicoId)
            ?? throw new InvalidOperationException("Técnico no encontrado.");

        // Validar que el tipo de servicio esté registrado (tiene su config .json)
        if (_config.Get(tipoServicio) is null)
            throw new InvalidOperationException($"Tipo de servicio no válido: {tipoServicio}");

        var anyo = DateTime.UtcNow.Year;
        var n = await _db.Informes.CountAsync(i => i.CreadoEn.Year == anyo) + 1;
        var informe = new Informe
        {
            Codigo = $"INF-{anyo}-{n:D5}",
            TecnicoId = tecnicoId,
            TipoServicio = tipoServicio,
            // Pre-llenado automático al crear el informe
            TallerNombre = TallerPorDefecto,
            TecnicoResponsable = tecnico.Nombre
        };
        _db.Informes.Add(informe);
        await _db.SaveChangesAsync();
        return (await ObtenerAsync(informe.Id))!;
    }

    public async Task<InformeDto?> ObtenerAsync(int id)
    {
        var i = await _db.Informes
            .Include(x => x.Tecnico)
            .Include(x => x.Fotos)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (i is null) return null;
        return ToDto(i);
    }

    public async Task<List<InformeListDto>> ListarAsync(int? tecnicoId, string? q, bool soloEliminados = false)
    {
        var query = _db.Informes.Include(i => i.Tecnico).AsQueryable();
        // Soft delete: por defecto solo informes activos; soloEliminados=true = papelera.
        query = query.Where(i => i.Eliminado == soloEliminados);
        if (tecnicoId.HasValue) query = query.Where(i => i.TecnicoId == tecnicoId.Value);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var qLow = q.ToLower();
            query = query.Where(i =>
                i.Tecnico.Nombre.ToLower().Contains(qLow) ||
                (i.ModeloProducto != null && i.ModeloProducto.ToLower().Contains(qLow)) ||
                (i.NumeroSerie != null && i.NumeroSerie.ToLower().Contains(qLow)) ||
                (i.ClienteNombre != null && i.ClienteNombre.ToLower().Contains(qLow)) ||
                i.Codigo.ToLower().Contains(qLow));
        }
        return await query
            .OrderByDescending(i => i.ActualizadoEn)
            .Select(i => new InformeListDto(
                i.Id, i.Codigo, i.Tecnico.Nombre,
                i.ClienteNombre, i.ModeloProducto, i.NumeroSerie,
                i.Estado, i.TipoServicio, i.FormaPago, i.ActualizadoEn))
            .ToListAsync();
    }

    public async Task<InformeDto> GuardarAsync(int id, GuardarInformeRequest r)
    {
        var i = await _db.Informes.FindAsync(id)
            ?? throw new InvalidOperationException("Informe no encontrado.");
        i.TallerNombre        = r.TallerNombre;
        i.TecnicoResponsable  = r.TecnicoResponsable;
        i.OrdenServicio       = r.OrdenServicio;
        i.NumeroSerie         = r.NumeroSerie;
        i.ClienteNombre       = r.ClienteNombre;
        i.LugarInstalacion    = r.LugarInstalacion;
        i.ModeloProducto      = r.ModeloProducto;
        i.Observaciones       = r.Observaciones;
        i.FormaPago           = r.FormaPago;
        i.ActualizadoEn       = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (await ObtenerAsync(id))!;
    }

    public async Task<FotoDto> SubirFotoAsync(int id, string slot, IFormFile archivo, IWebHostEnvironment env)
    {
        var informe = await _db.Informes.Include(i => i.Fotos).FirstOrDefaultAsync(i => i.Id == id)
            ?? throw new InvalidOperationException("Informe no encontrado.");
        // El slot debe existir en la configuración del tipo de servicio del informe
        if (!_config.SlotValido(informe.TipoServicio, slot))
            throw new InvalidOperationException("Slot inválido para este tipo de servicio.");
        if (archivo.Length == 0) throw new InvalidOperationException("Archivo vacío.");

        var anterior = informe.Fotos.FirstOrDefault(f => f.Slot == slot);
        if (anterior is not null)
        {
            EliminarArchivo(env, anterior.RutaRelativa);
            _db.Fotos.Remove(anterior);
        }

        var dir = Path.Combine(env.ContentRootPath, "uploads", id.ToString());
        Directory.CreateDirectory(dir);
        var ext = Path.GetExtension(archivo.FileName);
        if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";
        var nombre = $"{slot}_{DateTime.UtcNow:yyyyMMddHHmmssfff}{ext.ToLowerInvariant()}";
        var fullPath = Path.Combine(dir, nombre);

        await using (var fs = File.Create(fullPath))
            await archivo.CopyToAsync(fs);

        var rel = $"/uploads/{id}/{nombre}";
        var foto = new Foto { InformeId = id, Slot = slot, NombreArchivo = nombre, RutaRelativa = rel };
        _db.Fotos.Add(foto);
        informe.ActualizadoEn = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        // La URL apunta al endpoint autenticado, no al archivo estático público.
        return new FotoDto(foto.Id, foto.Slot, $"/informes/{id}/fotos/{foto.Id}/imagen");
    }

    public async Task EliminarFotoAsync(int id, int fotoId, IWebHostEnvironment env)
    {
        var f = await _db.Fotos.FirstOrDefaultAsync(x => x.InformeId == id && x.Id == fotoId)
            ?? throw new InvalidOperationException("Foto no encontrada.");
        EliminarArchivo(env, f.RutaRelativa);
        _db.Fotos.Remove(f);
        await _db.SaveChangesAsync();
    }

    public async Task<InformeDto> FinalizarAsync(int id)
    {
        var i = await _db.Informes.FindAsync(id) ?? throw new InvalidOperationException("No encontrado.");
        i.Estado = "finalizado";
        i.ActualizadoEn = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (await ObtenerAsync(id))!;
    }

    // Borrado LÓGICO (soft delete): el informe NO se elimina de la BD ni sus fotos
    // del disco. Solo se marca como eliminado y se oculta de la lista (ListarAsync
    // filtra Eliminado). Se puede deshacer con RestaurarAsync.
    // El parámetro env se conserva por compatibilidad de firma (ya no se usa archivos).
    // Autorización: un Técnico solo puede eliminar SUS informes; un Admin, cualquiera.
    public async Task EliminarAsync(int id, int solicitanteId, bool esAdmin, IWebHostEnvironment env)
    {
        var informe = await _db.Informes.FirstOrDefaultAsync(i => i.Id == id)
            ?? throw new InvalidOperationException("Informe no encontrado.");

        if (!esAdmin && informe.TecnicoId != solicitanteId)
            throw new UnauthorizedAccessException("No tienes permiso para eliminar este informe.");

        informe.Eliminado = true;
        informe.EliminadoEn = DateTime.UtcNow;
        informe.ActualizadoEn = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    // Restaura un informe previamente marcado como eliminado (lo saca de la papelera).
    // Autorización: un Técnico solo los suyos; un Admin, cualquiera.
    public async Task RestaurarAsync(int id, int solicitanteId, bool esAdmin)
    {
        var informe = await _db.Informes.FirstOrDefaultAsync(i => i.Id == id)
            ?? throw new InvalidOperationException("Informe no encontrado.");

        if (!esAdmin && informe.TecnicoId != solicitanteId)
            throw new UnauthorizedAccessException("No tienes permiso para restaurar este informe.");

        informe.Eliminado = false;
        informe.EliminadoEn = null;
        informe.ActualizadoEn = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    // Devuelve la RUTA de una foto para servirla de forma autenticada (streaming).
    // Autorización: un Técnico solo accede a fotos de SUS informes; un Admin, cualquiera.
    // Retorna null si el informe/foto/archivo no existe.
    public async Task<(string fullPath, string contentType)?> ObtenerFotoArchivoAsync(
        int informeId, int fotoId, int solicitanteId, bool esAdmin, IWebHostEnvironment env)
    {
        // Una sola consulta directa a la foto (con su informe) en vez de cargar todas las fotos.
        var foto = await _db.Fotos
            .Include(f => f.Informe)
            .FirstOrDefaultAsync(f => f.Id == fotoId && f.InformeId == informeId);
        if (foto is null) return null;

        if (!esAdmin && foto.Informe.TecnicoId != solicitanteId)
            throw new UnauthorizedAccessException("No tienes permiso para ver esta foto.");

        var path = Path.Combine(env.ContentRootPath, foto.RutaRelativa.TrimStart('/'));
        if (!File.Exists(path)) return null;

        var ext = Path.GetExtension(path).ToLowerInvariant();
        var contentType = ext switch
        {
            ".png"  => "image/png",
            ".webp" => "image/webp",
            _       => "image/jpeg"
        };
        return (path, contentType);
    }

    private static void EliminarArchivo(IWebHostEnvironment env, string rutaRelativa)
    {
        try
        {
            var clean = rutaRelativa.TrimStart('/');
            var full = Path.Combine(env.ContentRootPath, clean);
            if (File.Exists(full)) File.Delete(full);
        }
        catch { }
    }

    private static InformeDto ToDto(Informe i) => new(
        i.Id, i.Codigo, i.TecnicoId, i.Tecnico.Nombre,
        i.TipoServicio,
        i.TallerNombre, i.TecnicoResponsable,
        i.OrdenServicio, i.NumeroSerie, i.ClienteNombre,
        i.LugarInstalacion, i.ModeloProducto, i.Observaciones,
        i.FormaPago,
        i.Estado, i.CreadoEn, i.ActualizadoEn,
        // URL al endpoint autenticado que sirve la imagen (no al archivo estático público).
        i.Fotos.Select(f => new FotoDto(f.Id, f.Slot, $"/informes/{i.Id}/fotos/{f.Id}/imagen")).ToList());
}
