# Sistema de Informes Técnicos — LG Electronics

Aplicación web para que los técnicos de servicio de LG Electronics generen, gestionen y
exporten informes de instalación. Los informes se exportan a **Excel preservando la
plantilla oficial** (imágenes de cabecera, formas agrupadas, formato) y a **PDF**.

Aplicación en español. Soporta 7 tipos de servicio mediante un sistema de plantillas
configurable por JSON, sin tocar código.

---

## Tabla de contenidos

- [Stack](#stack)
- [Puesta en marcha](#puesta-en-marcha)
- [Configuración y secretos](#configuración-y-secretos)
- [Arquitectura](#arquitectura)
- [Modelo de datos](#modelo-de-datos)
- [Autenticación y roles](#autenticación-y-roles)
- [API](#api)
- [Sistema de plantillas](#sistema-de-plantillas)
- [Añadir un módulo de servicio nuevo](#añadir-un-módulo-de-servicio-nuevo)
- [Despliegue](#despliegue)
- [Seguridad](#seguridad)
- [Documentación relacionada](#documentación-relacionada)

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 · Vite 5 · React Router 6 · TailwindCSS 3 · Axios |
| Backend | .NET 8 Web API · Entity Framework Core 8 |
| Base de datos | SQL Server (producción) · SQLite (desarrollo local) |
| Exportación | Manipulación XLSX a bajo nivel (ZIP + `XDocument`) · QuestPDF |
| Auth | JWT Bearer (HMAC-SHA256) · PBKDF2-SHA256 (100 000 iteraciones) |

---

## Puesta en marcha

### Requisitos

- .NET 8 SDK
- Node.js 18 o superior

### Backend

```bash
cd backend/InformesTecnicos.Api

# Primera vez: crear el archivo de secretos a partir de la plantilla
cp appsettings.Secrets.example.json appsettings.Secrets.json
# ...y rellenar Jwt:Key y ConnectionStrings:conectionSql

dotnet restore
dotnet build
dotnet run          # http://localhost:5000
```

En desarrollo, `Properties/launchSettings.json` fuerza `Database__Provider=Sqlite` y una
base local (`local_dev.db`), que se crea y se siembra automáticamente al arrancar. La base
de producción solo es accesible desde el hosting.

Swagger UI: `http://localhost:5000/swagger`

### Frontend

```bash
cd frontend
npm install
npm run dev         # http://localhost:5173
npm run build       # build de producción → frontend/dist/
```

El servidor de desarrollo hace proxy de `/api/*` y `/uploads/*` hacia `http://localhost:5000`.
La URL base de la API se puede sobreescribir con `VITE_API_URL` (por defecto `/api`).

### Reiniciar la base de datos local

Borra `backend/InformesTecnicos.Api/local_dev.db` (o `informes.db`) y reinicia el backend.

### Credenciales sembradas

Al crear la base por primera vez se siembran dos usuarios de demostración. **Están
documentados en el código (`Data/DbSeeder.cs`) y por tanto son públicos** — cámbialos o
elimínalos antes de exponer la aplicación. Ver [Seguridad](#seguridad).

---

## Configuración y secretos

Los secretos **nunca** van en archivos versionados.

| Valor | Clave de configuración | Variable de entorno |
|---|---|---|
| Clave de firma JWT | `Jwt:Key` | `Jwt__Key` |
| Cadena de conexión SQL | `ConnectionStrings:conectionSql` | `ConnectionStrings__conectionSql` |

`Program.cs` carga la configuración en este orden (lo último gana):

1. `appsettings.json` — configuración no sensible, versionada
2. `appsettings.{Environment}.json`
3. `appsettings.Secrets.json` — **no versionado**, en `.gitignore`
4. Variables de entorno

Para desarrollo local: copia `appsettings.Secrets.example.json` a `appsettings.Secrets.json`.
Para producción: define las variables de entorno en el panel del hosting.

### `appsettings.json` (no sensible)

| Clave | Descripción |
|---|---|
| `Database:Provider` | `"SqlServer"` o `"Sqlite"` |
| `Jwt:Issuer` / `Jwt:Audience` | Validados en cada petición |
| `Jwt:ExpiresMinutes` | Vigencia del token (480 = 8 h) |
| `Cors:AllowedOrigins` | Orígenes permitidos del frontend |
| `Swagger:Enabled` | Expone Swagger fuera de desarrollo. **Debe ser `false` en producción** |
| `RateLimit:Login*` | Límite de login (por defecto 10 req/60 s por IP) |
| `RateLimit:Api*` | Límite general (por defecto 120 req/60 s por IP) |

---

## Arquitectura

### Backend — `backend/InformesTecnicos.Api/`

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Controllers | `AuthController`, `InformesController`, `AdminController` | Endpoints HTTP |
| Services | `AuthService`, `InformeService`, `AdminService`, `ExcelExportService`, `PdfExportService`, `TemplateConfigService` | Lógica de negocio |
| Data | `AppDbContext`, `DbSeeder` | Acceso a datos y siembra |
| Models | `Models/Models.cs` | Entidades `Usuario`, `Informe`, `Foto` |
| DTOs | `DTOs/Dtos.cs` | Records de petición y respuesta |

`Program.cs` configura EF Core, autenticación JWT, rate limiting, CORS, cabeceras de
seguridad y la carpeta de subidas.

Al arrancar ejecuta sentencias `ALTER TABLE` en crudo para añadir columnas que puedan
faltar en despliegues existentes (solución alternativa a las migraciones, ya que se usa
`EnsureCreated()` en lugar de `Migrate()`).

### Frontend — `frontend/src/`

**Rutas** (`App.jsx`):

| Ruta | Componente | Descripción |
|---|---|---|
| `/login` | `Login` | Inicio de sesión |
| `/change-password` | `ChangePassword` | Forzado si `MustChangePassword` |
| `/` | `InformesList` | Listado y búsqueda de informes |
| `/nuevo-informe` | `ModuleSelector` | Elegir tipo de servicio → crea el informe |
| `/informes/:id` | `InformeEditor` | Formulario, fotos y exportación |
| `/informes/:id/preview` | `InformePreview` | Vista de solo lectura |
| `/perfil` | `Perfil` | Datos del usuario |
| `/admin` | `AdminPanel` | Gestión de usuarios (solo rol Admin) |

**Archivos clave:**

| Archivo | Responsabilidad |
|---|---|
| `hooks/useAuth.jsx` | Contexto JWT; token en `localStorage`; intercepta 401 → `/login` |
| `hooks/useTheme.jsx` | Tema claro / oscuro |
| `services/api.js` | Instancia Axios con interceptor Bearer; expone `authApi`, `informesApi`, `adminApi` |
| `services/modulos.js` | Cachea `GET /api/informes/modulos`; hook `useModulos` |
| `components/FotoSlot.jsx` | Subida de imagen con arrastrar y soltar, por slot |
| `components/Shell.jsx` | Layout y navegación |
| `components/AuthImage.jsx` | Carga imágenes protegidas con el token |

---

## Modelo de datos

```
Usuarios (1) ──→ (N) Informes (1) ──→ (N) Fotos
```

- **Código de informe:** `INF-YYYY-#####`, autogenerado.
- **Estados:** `borrador` · `finalizado`.
- **`Informe.TipoServicio`** — se fija al crear, nunca cambia después.
- **`Informe.FormaPago`** (`efectivo` · `transferencia` · `free`) — se guarda en base de
  datos pero **nunca se exporta** a Excel ni a PDF.
- **Borrado lógico:** `Eliminado` + `EliminadoEn`; un Admin puede restaurar.
- **`Usuario.MustChangePassword`** — obliga a cambiar la contraseña en el siguiente login.

---

## Autenticación y roles

Claims del JWT: `sub` (id de usuario), `name`, `role` (`Admin` o `Tecnico`).

| Rol | Permisos |
|---|---|
| `Admin` | Ve todos los informes; borra y restaura; gestiona usuarios |
| `Tecnico` | Solo sus propios informes |

**Ciclo de vida de la contraseña:** el Admin crea el usuario → el backend genera una
contraseña temporal aleatoria → `MustChangePassword = true` → en el siguiente login el
frontend redirige a `/change-password` → tras el cambio se limpia el flag.

Las contraseñas se almacenan como `PBKDF2-SHA256`, 100 000 iteraciones, sal aleatoria de
16 bytes, en formato `base64(sal).base64(hash)`. La comparación es en tiempo constante.

---

## API

Todas las rutas requieren `Authorization: Bearer <token>` salvo `POST /api/auth/login`.

### Autenticación — `/api/auth`

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/login` | Devuelve token + usuario + `mustChangePassword`. Rate limit: 10/min |
| `POST` | `/change-password` | Cambia la contraseña y devuelve un token nuevo |
| `GET` | `/me` | Perfil del usuario autenticado |

### Informes — `/api/informes`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/modulos` | Catálogo de tipos de servicio (desde los JSON de configuración) |
| `GET` | `/` | Lista informes (filtrada por rol) |
| `GET` | `/{id}` | Detalle de un informe |
| `POST` | `/` | Crea un informe |
| `PUT` | `/{id}` | Actualiza los campos |
| `POST` | `/{id}/fotos` | Sube una foto a un slot (máx. 50 MB) |
| `DELETE` | `/{id}/fotos/{fotoId}` | Elimina una foto |
| `GET` | `/{id}/fotos/{fotoId}/imagen` | Descarga la imagen (autenticado) |
| `POST` | `/{id}/finalizar` | Marca el informe como `finalizado` |
| `DELETE` | `/{id}` | Borrado lógico — **solo Admin** |
| `POST` | `/{id}/restaurar` | Restaura un informe borrado — **solo Admin** |
| `GET` | `/{id}/exportar/excel` | Descarga el `.xlsx` |
| `GET` | `/{id}/exportar/pdf` | Descarga el `.pdf` |

### Administración — `/api/admin` (todo el controlador es `[Authorize(Roles = "Admin")]`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/usuarios` | Lista usuarios |
| `POST` | `/usuarios` | Crea usuario con contraseña temporal |
| `PUT` | `/usuarios/{id}/reset-password` | Genera contraseña temporal nueva |
| `PUT` | `/usuarios/{id}/toggle-activo` | Activa o desactiva el usuario |

Las fotos **no** se sirven de forma pública: el acceso pasa siempre por el endpoint
autenticado `GET /api/informes/{id}/fotos/{fotoId}/imagen`.

---

## Sistema de plantillas

`ExcelExportService` manipula el `.xlsx` **como un ZIP en crudo** (`System.IO.Compression`
+ `XDocument`) en lugar de usar ClosedXML. Esto preserva todo el contenido original de la
plantilla (formas agrupadas, imágenes de cabecera, VML) que una librería de más alto nivel
eliminaría al reescribir el archivo.

El servicio es **totalmente genérico**: no conoce ningún tipo de servicio concreto. Todos
los datos específicos vienen de `ITemplateConfigService`, que carga un JSON por plantilla
desde `Templates/config/*.json` al arrancar y lo cachea (singleton).

**Hoja destino:** se busca normalizando el nombre a `"formulariofotografico"` (quitando
acentos y espacios); si no aparece, se usa la primera hoja no oculta. El dibujo se resuelve
automáticamente desde los rels de la hoja. Funciona incluso con plantillas de nombre
distinto (TV usa `"RELATÓRIO DE INSTALAÇÃO TV"`).

### Formato del archivo de configuración

`Templates/config/{tipo}.json`:

```json
{
  "tipo": "wm",
  "label": "Lavadora (WM)",
  "descripcion": "Lavadora LG",
  "icono": "🌀",
  "imagen": "washtower.jpg",
  "plantilla": "Informe de instalacion - WM.xlsx",
  "campos": { "TallerNombre": "B10", "NumeroSerie": "I16" },
  "slots": [
    { "key": "serie", "label": "Nº Serie", "anchor": [0, 35, 5, 45] }
  ]
}
```

- **`campos`** — nombre de campo del informe → celda destino. Campos válidos (se resuelven
  en `ExcelExportService.ValorCampo`): `TallerNombre`, `TecnicoResponsable`,
  `OrdenServicio`, `NumeroSerie`, `ClienteNombre`, `LugarInstalacion`, `ModeloProducto`,
  `Observaciones`. Los valores vacíos se omiten; las filas y celdas que falten se crean
  respetando el orden.
- **`slots`** — lista ordenada de fotos. `anchor` es `[colInicio, filaInicio, colFin,
  filaFin]`, en **base 0**.
  > **Regla de coordenadas:** `filaInicio` (base 0) = el número de fila de Excel de la
  > etiqueta. Esto coloca la foto justo debajo de la etiqueta, porque la fila N en base 0
  > equivale a la fila N+1 de Excel.

Las fotos se incrustan en `xl/media/` y se registran en `[Content_Types].xml`,
`drawing.rels` y el XML del dibujo.

El frontend consume esa misma configuración vía `GET /api/informes/modulos`. El selector de
módulos, las rejillas de fotos, las etiquetas de la vista previa y las insignias del
listado son todos data-driven: no hay listas por tipo escritas a mano.

### Plantillas registradas

`washtower` · `refrigerador` (REF) · `wm` · `dryer` (9 fotos) · `estufas` · `rac` · `tv`

Cada una tiene sus propias celdas de campos y anclajes de fotos; TV además tiene una
disposición de hoja distinta.

---

## Añadir un módulo de servicio nuevo

**No hace falta tocar código.**

1. Copia la plantilla `.xlsx` en `Templates/`.
2. Crea `Templates/config/{tipo}.json` partiendo de uno existente. Define `plantilla`,
   `campos` (campo → celda) y `slots` (`key`, `label`, `[colIni, filaIni, colFin, filaFin]`).
3. *(Opcional)* añade una imagen en `frontend/img/` y regístrala en
   `frontend/src/services/modulos.js` → `IMAGENES` (clave = nombre del archivo). Sin
   imagen, el selector muestra una tarjeta con degradado y el emoji de `icono`.
4. *(Opcional)* añade el tipo al array `ordenPreferido` de `TemplateConfigService` para
   controlar su posición en el selector.

Para averiguar las coordenadas de una plantilla nueva, ábrela como ZIP: el `sheetData` de
la hoja visible da las celdas de las etiquetas, y las regiones de celdas combinadas y los
anclajes de dibujo existentes dan las posiciones de las fotos.

---

## Despliegue

| Pieza | Destino |
|---|---|
| Backend | Hosting IIS (MonsterASP / siteasp.net), `web.config` con `AspNetCoreModuleV2` |
| Base de datos | SQL Server gestionado (databaseasp.net) |
| Frontend | GitHub Pages, base path `/Electronic_sys/` (ver `vite.config.js`) |

**Antes de publicar** define en el panel del hosting las variables de entorno
`Jwt__Key` y `ConnectionStrings__conectionSql`, y asegúrate de que `Swagger:Enabled`
esté en `false`.

> Los perfiles de publicación de Visual Studio (`Properties/PublishProfiles/*.pubxml`) están
> excluidos del repositorio: contienen el usuario y el servidor de despliegue.

---

## Seguridad

### Qué está bien resuelto

- Contraseñas con PBKDF2-SHA256, 100 000 iteraciones y sal aleatoria; comparación en
  tiempo constante.
- Secretos fuera de los archivos versionados (`appsettings.Secrets.json` + variables de entorno).
- Rate limiting en login (10/min) y en la API general (120/min).
- Cabeceras de seguridad: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy` y `HSTS` fuera de desarrollo.
- Las fotos no se sirven públicamente; el acceso es autenticado y validado por informe.
- Autorización por rol en los endpoints de administración y de borrado.

### Puntos a revisar

| Punto | Dónde | Riesgo |
|---|---|---|
| CORS abierto a cualquier origen | `Program.cs` — usa `AllowAnyOrigin()` e ignora `Cors:AllowedOrigins` | Cualquier web puede llamar a la API |
| Swagger expuesto en producción | `appsettings.json` → `Swagger:Enabled: true` | Publica el mapa completo de la API |
| Usuarios de demo sembrados | `Data/DbSeeder.cs` — `admin@empresa.com` / `admin123` | Contraseñas conocidas con rol Admin |
| Carpeta `publish/` versionada | Contenía los `appsettings` con secretos ya resueltos | Fuga de credenciales |

### Reglas para no filtrar credenciales

1. **Nunca commitear la carpeta `publish/` ni `bin/`.** Los `appsettings` que hay dentro
   llevan la cadena de conexión y la clave JWT ya resueltas, no las plantillas.
2. **Los secretos solo en `appsettings.Secrets.json` o en variables de entorno.** El
   archivo `.example` versionado solo lleva valores de relleno.
3. **Añadir la regla al `.gitignore` no basta si el archivo ya está rastreado.** Hay que
   sacarlo del índice con `git rm --cached <ruta>` y, si ya se subió, purgar el historial.
4. **Revisar antes de cada commit:** `git status` y `git diff --cached` antes de
   `git commit`. Si aparece algo bajo `publish/`, `bin/` o `.env`, parar.
5. **Si una credencial llega a subirse, rotarla.** Borrar el commit no basta: hay que dar
   por comprometido el valor y cambiarlo en el origen.

---

## Documentación relacionada

- **[GUIA-CAMBIOS.md](GUIA-CAMBIOS.md)** — guía rápida del estado actual del proyecto y
  mapa de dónde tocar cada cosa. Léela antes de hacer cambios.
- `database/schema_sqlserver.sql` — esquema de SQL Server para instalación manual.
- `appsettings.Secrets.example.json` — plantilla del archivo de secretos.
