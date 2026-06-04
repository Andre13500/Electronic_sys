# Informes Técnicos - WashTower

Sistema simple para llenar informes técnicos y exportarlos al formato Excel/PDF oficial de la empresa.

## Estructura

```
InformesTecnicos/
├── backend/   → API .NET 8 (ClosedXML + QuestPDF)
├── frontend/  → React + Vite + Tailwind
└── database/  → Script SQL Server (opcional)
```

## Stack

- **Backend:** .NET 8 + Entity Framework Core + SQLite (por defecto) + ClosedXML + QuestPDF
- **Frontend:** React 18 + Vite + TailwindCSS

## Cómo correr

### 1) Backend

```bash
cd backend/InformesTecnicos.Api
dotnet restore
dotnet run
```

API en `http://localhost:5000`. La base de datos SQLite se crea automáticamente con datos de prueba.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

App en `http://localhost:5173`.

## Usuarios de prueba

| Rol     | Email                | Contraseña   |
|---------|----------------------|--------------|
| Técnico | tecnico@empresa.com  | tecnico123   |
| Admin   | admin@empresa.com    | admin123     |

## Funcionalidades

1. Login
2. Crear / continuar / ver informes
3. Llenar formulario (Datos del Taller, Cliente, Fotos, Observaciones)
4. Subir 6 fotos del servicio (con preview y reemplazo)
5. Filtrar lista por técnico o por máquina (modelo)
6. Exportar a **Excel** → usa la plantilla oficial `WashTower_Template.xlsx` preservando logo LG, estilos, posiciones, tamaños
7. Exportar a **PDF** → réplica visual del formato oficial

## Punto clave - Exportación Excel

El motor de exportación **NO genera el Excel desde cero**. Carga la plantilla oficial `Templates/WashTower_Template.xlsx` con ClosedXML, escribe los valores en las celdas exactas y reemplaza las fotos en sus anchors originales, preservando:

- Logo LG y demás imágenes fijas
- Merges, anchos, alturas y estilos
- Posiciones y tamaños

Para añadir un nuevo tipo de informe en el futuro: subir el `.xlsx` oficial a `Templates/`, crear un registro en `Plantillas` y añadir el mapeo de campos → celdas en el seeder.
