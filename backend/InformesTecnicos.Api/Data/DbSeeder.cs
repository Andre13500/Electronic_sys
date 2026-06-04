using InformesTecnicos.Api.Models;
using InformesTecnicos.Api.Services;

namespace InformesTecnicos.Api.Data;

public static class DbSeeder
{
    public static void Seed(AppDbContext db)
    {
        if (db.Usuarios.Any()) return;

        db.Usuarios.AddRange(
            new Usuario { Nombre = "Administrador",  Email = "admin@empresa.com",   PasswordHash = PasswordHasher.Hash("admin123"),   Rol = "Admin" },
            new Usuario { Nombre = "Omar Enriquez",  Email = "tecnico@empresa.com", PasswordHash = PasswordHasher.Hash("tecnico123"), Rol = "Tecnico" }
        );
        db.SaveChanges();
    }
}
