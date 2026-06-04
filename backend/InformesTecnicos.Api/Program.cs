using InformesTecnicos.Api.Data;
using InformesTecnicos.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using QuestPDF.Infrastructure;
using System.Text;

QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

// --- DB (SQLite por defecto, SQL Server opcional) ---
builder.Services.AddDbContext<AppDbContext>(opt =>
{
    var provider = cfg["Database:Provider"] ?? "Sqlite";
    var conn = cfg.GetConnectionString("Default") ?? "Data Source=informes.db";
    if (provider.Equals("SqlServer", StringComparison.OrdinalIgnoreCase))
        opt.UseSqlServer(conn);
    else
        opt.UseSqlite(conn);
});

// --- Servicios ---
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddScoped<IInformeService, InformeService>();
builder.Services.AddScoped<IExcelExportService, ExcelExportService>();
builder.Services.AddScoped<IPdfExportService, PdfExportService>();

// --- JWT ---
var jwtKey = cfg["Jwt:Key"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = cfg["Jwt:Issuer"],
            ValidAudience = cfg["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });
builder.Services.AddAuthorization();

// --- API + CORS ---
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(o => o.AddPolicy("Front", p => p
    .WithOrigins("http://localhost:5173", "http://localhost:3000")
    .AllowAnyHeader().AllowAnyMethod()));

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o =>
    o.MultipartBodyLengthLimit = 50 * 1024 * 1024);

var app = builder.Build();

// --- Inicialización DB ---
// NOTA: Se usa EnsureCreated (no migraciones). Si la BD ya existe con el esquema antiguo,
// el código de abajo agrega las columnas nuevas automáticamente con try/catch.
// Si hay errores, elimina informes.db y reinicia para recrear desde cero.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();

    // Agregar columnas nuevas a BD existente sin perder datos
    // Sintaxis diferente según proveedor (SQLite vs SQL Server)
    var isSqlite = db.Database.ProviderName?.Contains("Sqlite", StringComparison.OrdinalIgnoreCase) == true;
    if (isSqlite)
    {
        try { db.Database.ExecuteSqlRaw("ALTER TABLE Usuarios ADD COLUMN MustChangePassword INTEGER NOT NULL DEFAULT 0"); } catch { }
        try { db.Database.ExecuteSqlRaw("ALTER TABLE Informes ADD COLUMN TipoServicio TEXT NOT NULL DEFAULT 'washtower'"); } catch { }
        try { db.Database.ExecuteSqlRaw("ALTER TABLE Informes ADD COLUMN FormaPago TEXT NULL"); } catch { }
    }
    else
    {
        // SQL Server: usa IF NOT EXISTS para no fallar si la columna ya existe
        try { db.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Usuarios') AND name='MustChangePassword')
                ALTER TABLE Usuarios ADD MustChangePassword bit NOT NULL DEFAULT 0"); } catch { }
        try { db.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Informes') AND name='TipoServicio')
                ALTER TABLE Informes ADD TipoServicio nvarchar(30) NOT NULL DEFAULT 'washtower'"); } catch { }
        try { db.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('Informes') AND name='FormaPago')
                ALTER TABLE Informes ADD FormaPago nvarchar(30) NULL"); } catch { }
    }

    DbSeeder.Seed(db);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Front");

// Servir uploads
var uploads = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploads);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploads),
    RequestPath = "/uploads"
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
