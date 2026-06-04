# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Technical report management system for LG Electronics service technicians. Generates Excel and PDF exports that preserve the official WashTower service report template layout. Spanish-language application.

## Commands

### Backend (.NET 8 / ASP.NET Core)
```bash
cd backend/InformesTecnicos.Api
dotnet restore
dotnet build
dotnet run          # Runs on http://localhost:5000
```
- Swagger UI at `http://localhost:5000/swagger`
- SQLite database (`informes.db`) is auto-created on first run with seeded demo users

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev         # Dev server on http://localhost:5173
npm run build       # Production build
```
- Dev proxy routes `/api/*` and `/uploads/*` to `http://localhost:5000`

### Start Both Together (Windows)
```bat
start.bat
```

## Architecture

**Full-stack:** React 18 (Vite) frontend + .NET 8 Web API backend + SQLite (default) or SQL Server.

### Backend (`backend/InformesTecnicos.Api/`)
- **Controllers/**: `AuthController` (login → JWT), `InformesController` (CRUD, photo upload, Excel/PDF export)
- **Services/**: `InformeService` (business logic), `ExcelExportService` (ClosedXML template manipulation), `PdfExportService` (QuestPDF), `AuthService` (PBKDF2 hashing + JWT)
- **Data/**: `AppDbContext` (EF Core), `DbSeeder` (seeds demo users on startup)
- **Templates/**: `WashTower_Template.xlsx` — the official LG template that exports must preserve
- **uploads/**: Photo storage at `/uploads/{informeId}/{filename}`

### Frontend (`frontend/src/`)
- **pages/**: `Login`, `InformesList` (search/list), `InformeEditor` (form + photo slots + export)
- **components/**: `Shell` (layout), `FotoSlot` (drag-drop image upload with preview)
- **hooks/useAuth.jsx**: JWT token context — stores in localStorage, intercepts 401s, redirects to login
- **services/api.js**: Axios instance with Bearer token interceptor

### Data Model
- `Usuarios` → `Informes` (1-to-many, cascade delete) → `Fotos` (1-to-many, cascade delete)
- Report codes auto-generated as `INF-YYYY-#####`
- Report states: `borrador` (draft) | `finalizado` (complete)
- 6 fixed photo slots per report: `serie`, `accesorios`, `presion`, `alimentacion`, `nivelacion`, `equipo`

### Auth Flow
JWT tokens include `sub` (user ID), `name`, and `role` (`Admin` | `Tecnico`) claims. Admins see all reports; Técnicos see only their own.

## Excel Export (Critical Feature)

`ExcelExportService` loads `WashTower_Template.xlsx` via ClosedXML and writes to **hard-coded cell coordinates** on the worksheet named `"Formulário Fotográfico"`:

| Field | Cell |
|---|---|
| Workshop name | B10 |
| Technician | H10 |
| Service order | B16 |
| Serial number | I16 |
| Client name | B18 |
| Installation location | B20 |
| Product model | B22 |

Photos are placed into **hard-coded image anchor ranges**:

| Slot | Cell Range |
|---|---|
| serie | A37:F47 |
| accesorios | G37:J47 |
| presion | K37:O47 |
| alimentacion | B54:F64 |
| nivelacion | F53:K64 |
| equipo | L54:O64 |

If the template structure or worksheet name changes, update `ExcelExportService.cs` accordingly.

## Key Configuration

**`appsettings.json`** — JWT key (`Jwt:Key`) is a placeholder; must be changed for production. Database provider switches between `Sqlite` and `SqlServer` via `Database:Provider`.

**`tailwind.config.js`** — LG brand red `#a50034` is the primary color. Component classes (`.btn-primary`, `.input`, `.card`, etc.) are defined in `index.css`.

## Demo Credentials (seeded on first run)
- `tecnico@empresa.com` / `tecnico123` (Técnico role)
- `admin@empresa.com` / `admin123` (Admin role)

To reset the database, delete `backend/InformesTecnicos.Api/informes.db` and restart the backend.
