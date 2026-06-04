using InformesTecnicos.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace InformesTecnicos.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Informe> Informes => Set<Informe>();
    public DbSet<Foto> Fotos => Set<Foto>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<Usuario>().HasIndex(u => u.Email).IsUnique();
        mb.Entity<Informe>().HasIndex(i => i.Codigo).IsUnique();
        mb.Entity<Informe>()
            .HasMany(i => i.Fotos)
            .WithOne(f => f.Informe)
            .HasForeignKey(f => f.InformeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
