using InformesTecnicos.Api.Data;
using InformesTecnicos.Api.DTOs;
using InformesTecnicos.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace InformesTecnicos.Api.Services;

public interface IInformeService
{
    Task<InformeDto> CrearAsync(int tecnicoId, string tipoServicio);
    Task<InformeDto?> ObtenerAsync(int id);
    Task<List<InformeListDto>> ListarAsync(int? tecnicoId, string? q);
    Task<InformeDto> GuardarAsync(int id, GuardarInformeRequest req);
    Task<FotoDto> SubirFotoAsync(int id, string slot, IFormFile archivo, IWebHostEnvironment env);
    Task EliminarFotoAsync(int id, int fotoId, IWebHostEnvironment env);
    Task<InformeDto> FinalizarAsync(int id);
}

public class InformeService : IInformeService
{
    // ===== SLOTS VÁLIDOS =====
    // Para agregar slots de un nuevo tipo de servicio:
    //   1. Añade los nombres de slot a este array
    //   2. En el frontend: InformeEditor.jsx > SLOTS_POR_TIPO
    //   3. En ExcelExportService.cs agrega el mapeo de slot → rango de celda para el nuevo tipo
    private static readonly string[] SlotsValidos =
        { "serie", "accesorios", "presion", "alimentacion", "nivelacion", "equipo" };

    // Nombre del taller por defecto (pre-llenado al crear informe)
    // Cambia este valor si el nombre del taller cambia
    private const string TallerPorDefecto = "Electronic Shop";

    private readonly AppDbContext _db;
    public InformeService(AppDbContext db) => _db = db;

    public async Task<InformeDto> CrearAsync(int tecnicoId, string tipoServicio)
    {
        var tecnico = await _db.Usuarios.FindAsync(tecnicoId)
            ?? throw new InvalidOperationException("Técnico no encontrado.");

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

    public async Task<List<InformeListDto>> ListarAsync(int? tecnicoId, string? q)
    {
        var query = _db.Informes.Include(i => i.Tecnico).AsQueryable();
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
        if (!SlotsValidos.Contains(slot))
            throw new InvalidOperationException("Slot inválido.");
        var informe = await _db.Informes.Include(i => i.Fotos).FirstOrDefaultAsync(i => i.Id == id)
            ?? throw new InvalidOperationException("Informe no encontrado.");
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
        return new FotoDto(foto.Id, foto.Slot, foto.RutaRelativa);
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
        i.Fotos.Select(f => new FotoDto(f.Id, f.Slot, f.RutaRelativa)).ToList());
}
