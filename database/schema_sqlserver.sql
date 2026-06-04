-- =====================================================================
-- Script SQL Server OPCIONAL.
-- Por defecto el sistema usa SQLite (sin instalación).
-- Para usar SQL Server: ejecutar este script y luego editar appsettings.json:
--   "Database": { "Provider": "SqlServer" }
--   "ConnectionStrings": {
--     "Default": "Server=localhost;Database=InformesTecnicos;Trusted_Connection=True;TrustServerCertificate=True"
--   }
-- =====================================================================

CREATE DATABASE InformesTecnicos;
GO
USE InformesTecnicos;
GO

CREATE TABLE Usuarios (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    Nombre        NVARCHAR(120) NOT NULL,
    Email         NVARCHAR(120) NOT NULL UNIQUE,
    PasswordHash  NVARCHAR(MAX) NOT NULL,
    Rol           NVARCHAR(20)  NOT NULL DEFAULT 'Tecnico',
    Activo        BIT           NOT NULL DEFAULT 1,
    CreadoEn      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE Informes (
    Id                  INT IDENTITY(1,1) PRIMARY KEY,
    Codigo              NVARCHAR(30)  NOT NULL UNIQUE,
    TecnicoId           INT           NOT NULL,
    TallerNombre        NVARCHAR(150) NULL,
    TecnicoResponsable  NVARCHAR(150) NULL,
    OrdenServicio       NVARCHAR(80)  NULL,
    NumeroSerie         NVARCHAR(80)  NULL,
    ClienteNombre       NVARCHAR(150) NULL,
    LugarInstalacion    NVARCHAR(200) NULL,
    ModeloProducto      NVARCHAR(100) NULL,
    Observaciones       NVARCHAR(2000) NULL,
    Estado              NVARCHAR(20)  NOT NULL DEFAULT 'borrador',
    CreadoEn            DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    ActualizadoEn       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Informes_Usuarios FOREIGN KEY (TecnicoId) REFERENCES Usuarios(Id)
);
CREATE INDEX IX_Informes_TecnicoId      ON Informes(TecnicoId);
CREATE INDEX IX_Informes_ModeloProducto ON Informes(ModeloProducto);
CREATE INDEX IX_Informes_NumeroSerie    ON Informes(NumeroSerie);

CREATE TABLE Fotos (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    InformeId     INT           NOT NULL,
    Slot          NVARCHAR(30)  NOT NULL,
    NombreArchivo NVARCHAR(255) NOT NULL,
    RutaRelativa  NVARCHAR(500) NOT NULL,
    SubidaEn      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Fotos_Informes FOREIGN KEY (InformeId) REFERENCES Informes(Id) ON DELETE CASCADE
);
CREATE INDEX IX_Fotos_InformeId ON Fotos(InformeId);
GO
