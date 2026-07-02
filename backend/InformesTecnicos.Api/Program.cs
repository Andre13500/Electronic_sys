using InformesTecnicos.Api.Data;
using InformesTecnicos.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using QuestPDF.Infrastructure;
using System.Text;
using System.Threading.RateLimiting;

QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

// Carga de secretos (clave JWT, cadena de conexión) desde un archivo NO versionado.
// En producción también pueden venir de variables de entorno (Jwt__Key,
// ConnectionStrings__conectionSql), que tienen prioridad sobre los archivos.
builder.Configuration.AddJsonFile("appsettings.Secrets.json", optional: true, reloadOnChange: true);
builder.Configuration.AddEnvironmentVariables();

var cfg = builder.Configuration;

// --- DB ---
builder.Services.AddDbContext<AppDbContext>(opt =>
{
    var provider = cfg["Database:Provider"] ?? "SqlServer";
    var conn = cfg.GetConnectionString("conectionSql")!;
    if (provider.Equals("SqlServer", StringComparison.OrdinalIgnoreCase))
        // EnableRetryOnFailure: reintenta ante fallos transitorios de red hacia la BD
        // remota (ej. databaseasp.net), en vez de tumbar la app al primer fallo.
        opt.UseSqlServer(conn, sql =>
        {
            sql.EnableRetryOnFailure(
                maxRetryCount: 3,
                maxRetryDelay: TimeSpan.FromSeconds(5),
                errorNumbersToAdd: null);
            // Corta consultas colgadas a los 30s en vez de esperar indefinidamente.
            sql.CommandTimeout(30);
        });
    else
        opt.UseSqlite(conn);
});

// --- Servicios ---
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddScoped<IInformeService, InformeService>();
// Configuración de plantillas (Templates/config/*.json). Singleton: se carga una vez al iniciar.
builder.Services.AddSingleton<ITemplateConfigService, TemplateConfigService>();
builder.Services.AddScoped<IExcelExportService, ExcelExportService>();
builder.Services.AddScoped<IPdfExportService, PdfExportService>();

// --- JWT ---
var jwtKey = cfg["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key no configurado");
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
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.Zero
        };
    });
builder.Services.AddAuthorization();

// --- Rate Limiting ---
builder.Services.AddRateLimiter(rl =>
{
    var loginWindow  = int.TryParse(cfg["RateLimit:LoginWindowSeconds"], out var lw)  ? lw  : 60;
    var loginMax     = int.TryParse(cfg["RateLimit:LoginMaxRequests"],   out var lm)  ? lm  : 10;
    var apiWindow    = int.TryParse(cfg["RateLimit:ApiWindowSeconds"],   out var aw)  ? aw  : 60;
    var apiMax       = int.TryParse(cfg["RateLimit:ApiMaxRequests"],     out var am)  ? am  : 120;

    // Login: máx 10 intentos por minuto por IP
    rl.AddFixedWindowLimiter("login", o =>
    {
        o.Window              = TimeSpan.FromSeconds(loginWindow);
        o.PermitLimit         = loginMax;
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        o.QueueLimit          = 0;
    });

    // API general: máx 120 req/min por IP
    rl.AddFixedWindowLimiter("api", o =>
    {
        o.Window              = TimeSpan.FromSeconds(apiWindow);
        o.PermitLimit         = apiMax;
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        o.QueueLimit          = 0;
    });

    rl.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    rl.OnRejected = async (ctx, _) =>
    {
        ctx.HttpContext.Response.Headers.RetryAfter = "60";
        await ctx.HttpContext.Response.WriteAsJsonAsync(new { error = "Demasiadas solicitudes. Intente más tarde." });
    };
});

// --- CORS ---
builder.Services.AddCors(o => o.AddPolicy("Front", p => p
    .AllowAnyOrigin()
    .AllowAnyHeader()
    .AllowAnyMethod()));

// --- API ---
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o =>
    o.MultipartBodyLengthLimit = 50 * 1024 * 1024);

var app = builder.Build();

// --- Inicialización DB ---
try
{
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.EnsureCreated();

        var isSqlite = db.Database.ProviderName?.Contains("Sqlite", StringComparison.OrdinalIgnoreCase) == true;
        if (isSqlite)
        {
            try { db.Database.ExecuteSqlRaw("ALTER TABLE Usuarios ADD COLUMN MustChangePassword INTEGER NOT NULL DEFAULT 0"); } catch { }
            try { db.Database.ExecuteSqlRaw("ALTER TABLE Informes ADD COLUMN TipoServicio TEXT NOT NULL DEFAULT 'washtower'"); } catch { }
            try { db.Database.ExecuteSqlRaw("ALTER TABLE Informes ADD COLUMN FormaPago TEXT NULL"); } catch { }
        }
        else
        {
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
}
catch (Exception ex)
{
    Console.WriteLine($"[STARTUP ERROR] Fallo al inicializar la BD: {ex.Message}");
}

// --- Headers de seguridad ---
app.Use(async (ctx, next) =>
{
    var headers = ctx.Response.Headers;
    headers.Append("X-Content-Type-Options", "nosniff");
    headers.Append("X-Frame-Options", "DENY");
    headers.Append("X-XSS-Protection", "1; mode=block");
    headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.Append("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (!app.Environment.IsDevelopment())
        headers.Append("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    await next();
});


// Swagger: siempre en desarrollo; en producción solo si "Swagger:Enabled" = true.
// Para OCULTARLO en producción, pon "Swagger": { "Enabled": false } en appsettings.
if (app.Environment.IsDevelopment() || app.Configuration.GetValue("Swagger:Enabled", false))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Front");
app.UseRateLimiter();

// Carpeta de subidas (solo se crea; las fotos NO se sirven de forma pública).
// El acceso a las imágenes es autenticado vía GET /api/informes/{id}/fotos/{fotoId}/imagen.
var uploads = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploads);

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
