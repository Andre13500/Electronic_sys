# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Technical report management system for LG Electronics service technicians. Generates Excel and PDF exports that preserve the official WashTower service report template layout. Spanish-language application. Supports multiple service modules (WashTower, Refrigeradora) with a shared slot-based photo system.

## Commands

### Backend (.NET 8 / ASP.NET Core)
```bash
cd backend/InformesTecnicos.Api
dotnet restore
dotnet build
dotnet run          # http://localhost:5000
```
- Swagger UI at `http://localhost:5000/swagger` (Development environment only; hidden in Production)
- SQLite DB (`informes.db`) is auto-created and seeded on first run

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev         # http://localhost:5173
npm run build       # Production build to frontend/dist/
```
- Dev proxy routes `/api/*` and `/uploads/*` to `http://localhost:5000`
- Production base path is `/Electronic_sys/` (configured in `vite.config.js` for GitHub Pages)
- Override API base URL with env var `VITE_API_URL` (defaults to `/api`)

### Reset database
Delete `backend/InformesTecnicos.Api/informes.db` and restart the backend.

## Architecture

**Full-stack:** React 18 (Vite) + .NET 8 Web API + SQLite (default) or SQL Server.

### Backend (`backend/InformesTecnicos.Api/`)

| Layer | Files | Responsibility |
|---|---|---|
| Controllers | `AuthController`, `InformesController`, `AdminController` | HTTP endpoints |
| Services | `AuthService`, `InformeService`, `AdminService`, `ExcelExportService`, `PdfExportService` | Business logic |
| Data | `AppDbContext` (EF Core), `DbSeeder` | DB access + seeding |
| Models | `Models/Models.cs` | `Usuario`, `Informe`, `Foto` entities |
| DTOs | `DTOs/Dtos.cs` | All request/response records |

**`Program.cs`** wires up: EF Core (SQLite or SQL Server), JWT auth, rate limiting (login: 10 req/min, API: 120 req/min), CORS (origins from `Cors:AllowedOrigins`), security headers middleware, and static file serving for `/uploads/`.

The startup block also runs raw SQL `ALTER TABLE` statements to add columns that may be missing in existing SQLite/SQL Server deployments (schema migration workaround).

### Frontend (`frontend/src/`)

**Routes** (defined in `App.jsx`):
- `/login` → `Login`
- `/change-password` → `ChangePassword` (forced redirect when `MustChangePassword=true`)
- `/` → `InformesList` (search + list)
- `/nuevo-informe` → `ModuleSelector` (choose service type → creates report)
- `/informes/:id` → `InformeEditor` (form + photo slots + export)
- `/informes/:id/preview` → `InformePreview` (read-only summary)
- `/admin` → `AdminPanel` (Admin role only — user management)

**Key files:**
- `hooks/useAuth.jsx` — JWT context; stores token in `localStorage`; intercepts 401 → redirect to `/login`; exposes `mustChangePassword` flag
- `services/api.js` — Axios instance with Bearer token interceptor; exports `authApi`, `informesApi`, `adminApi`
- `components/FotoSlot.jsx` — drag-drop image upload with preview, per slot
- `components/Shell.jsx` — app shell layout with nav

### Data Model

```
Usuarios (1) ──→ (N) Informes (1) ──→ (N) Fotos
```
- Report codes: `INF-YYYY-#####` (auto-generated)
- Report states: `borrador` | `finalizado`
- `Usuario.MustChangePassword` — forces password change on next login
- `Informe.FormaPago` (`efectivo` | `transferencia` | `free`) — stored in DB only, **never exported** to Excel or PDF
- `Informe.TipoServicio` — set at creation, never changed afterward

### Auth & Authorization

JWT claims: `sub` (user ID), `name`, `role` (`Admin` | `Tecnico`).  
Admins see all reports; Técnicos see only their own.  
`AdminController` endpoints are `[Authorize(Roles = "Admin")]`.

**Password lifecycle:** Admin creates user → backend generates a random temporary password → `MustChangePassword = true` → on next login, frontend redirects to `/change-password` → after change, flag cleared.

## Excel Export (Critical Feature)

`ExcelExportService` manipulates the `.xlsx` as a raw ZIP (using `System.IO.Compression` + `XDocument`) instead of ClosedXML. This preserves all original template content (grouped shapes, header images, VML) that higher-level libraries would strip.

**The service is fully generic and config-driven.** It knows nothing about any specific service type. All template-specific data comes from `ITemplateConfigService` (see `Services/TemplateConfigService.cs`), which loads one JSON file per template from `Templates/config/*.json` at startup and caches it (singleton).

**Target sheet:** found by normalizing the name to `"formulariofotografico"` (strips accents/spaces); falls back to the first non-hidden sheet. The drawing is auto-resolved from the sheet's rels (non-VML `/drawing` relationship). This works even for templates with a different sheet name (e.g. TV uses `"RELATÓRIO DE INSTALAÇÃO TV"`).

**Config file shape** (`Templates/config/{tipo}.json`):
```json
{
  "tipo": "wm",
  "label": "Lavadora (WM)",
  "descripcion": "Lavadora LG",
  "icono": "🌀",
  "imagen": "washtower.jpg",
  "plantilla": "Informe de instalacion - WM.xlsx",
  "campos": { "TallerNombre": "B10", "NumeroSerie": "I16", ... },
  "slots": [ { "key": "serie", "label": "Nº Serie", "anchor": [0, 35, 5, 45] }, ... ]
}
```
- `campos` — informe field name → target cell. Valid field names: `TallerNombre`, `TecnicoResponsable`, `OrdenServicio`, `NumeroSerie`, `ClienteNombre`, `LugarInstalacion`, `ModeloProducto`, `Observaciones` (resolved in `ExcelExportService.ValorCampo`). Empty values are skipped; missing rows/cells are created preserving order.
- `slots` — ordered list of photos. `anchor` is `[colStart, rowStart, colEnd, rowEnd]`, 0-based. **Coordinate rule:** `rowStart` (0-based) = the Excel row number of the label (which places the photo just below the label, since 0-based row N = Excel row N+1).

Photos are embedded into `xl/media/` and registered in `[Content_Types].xml`, `drawing.rels`, and the drawing XML.

**Frontend consumes the same config** via `GET /api/informes/modulos` (`InformesController.Modulos`), cached client-side by `frontend/src/services/modulos.js` (`useModulos` hook). The module selector, photo grids, preview labels, and list badges are all data-driven — no hardcoded per-type lists.

**Registered templates** (`Templates/` + matching `Templates/config/*.json`):
`washtower`, `refrigerador` (REF), `wm`, `dryer` (9 photos), `estufas`, `rac`, `tv`. Each has distinct field cells and photo anchors; TV additionally has a distinct sheet layout.

## Adding a New Service Module

**No code changes required.** To add a module:

1. Drop the template `.xlsx` into `Templates/`.
2. Create `Templates/config/{tipo}.json` (copy an existing one). Set `plantilla`, `campos` (field → cell), and `slots` (key + label + `[colStart,rowStart,colEnd,rowEnd]`).
3. (Optional) add an image in `frontend/img/` and register it in `frontend/src/services/modulos.js` → `IMAGENES` (keyed by the `imagen` filename). Without an image, the selector shows a gradient card with the `icono` emoji.
4. (Optional) add the new tipo to the `ordenPreferido` array in `TemplateConfigService` to control its position in the selector.

To find cell/anchor coordinates for a new template, inspect it as a ZIP: the visible sheet's `sheetData` gives label cells; merged-cell regions and existing drawing anchors give photo positions.

## Key Configuration

**Secrets** — `Jwt:Key` and `ConnectionStrings:conectionSql` are **not** in `appsettings.json` (which is versioned). They load from `appsettings.Secrets.json` (gitignored) or environment variables (`Jwt__Key`, `ConnectionStrings__conectionSql`), added in `Program.cs` after the defaults. Copy `appsettings.Secrets.example.json` → `appsettings.Secrets.json` for local dev; in production set the env vars (or upload the secrets file) in the hosting panel.

**`appsettings.json`** (backend, non-secret config):
- `Jwt:Issuer`, `Jwt:Audience`, `Jwt:ExpiresMinutes` — validated on every request
- `Database:Provider` — `"SqlServer"` (default) or `"Sqlite"`
- `Cors:AllowedOrigins` — array of allowed frontend origins
- `RateLimit:LoginWindowSeconds/LoginMaxRequests` — login throttle (default 10/60s)
- `RateLimit:ApiWindowSeconds/ApiMaxRequests` — general API throttle (default 120/60s)

**`frontend/tailwind.config.js`** — LG brand red `#a50034` as `brand-*` color scale. Component classes (`.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input`, `.label`, `.card`) defined in `index.css`.

**`database/schema_sqlserver.sql`** — SQL Server schema for manual setup.

## Demo Credentials (seeded on first run)
- `tecnico@empresa.com` / `tecnico123` (Técnico)
- `admin@empresa.com` / `admin123` (Admin)

Default workshop name pre-filled on report creation: `"Electronic Shop"` (`TallerPorDefecto` constant in `InformeService.cs`).
