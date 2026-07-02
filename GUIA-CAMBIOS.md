# GUÍA RÁPIDA DE CAMBIOS — InformesTecnicos LG

> **Para Claude:** lee SOLO este archivo antes de un cambio. Contiene el mapa del proyecto y
> el estado actual, para no re-escanear todo. Si algo aquí contradice el código, el código manda
> (avísalo). Actualiza este archivo cuando hagas cambios estructurales.

Stack: **React 18 + Vite** (frontend) · **.NET 8 Web API** (backend) · **SQLite / SQL Server**.
App en español, para técnicos de servicio LG. Exporta informes a Excel preservando la plantilla oficial.

---

## 1. SISTEMA DE PLANTILLAS (lo más importante — todo es config-driven)

Cada tipo de servicio se define en **`backend/InformesTecnicos.Api/Templates/config/{tipo}.json`**.
Hay 7: `washtower, refrigerador, wm, dryer, estufas, rac, tv`.
El backend es **genérico**: no conoce ningún tipo; todo sale del JSON.

Estructura de un config:
```json
{
  "tipo": "wm", "label": "Lavadora (WM)", "descripcion": "...",
  "icono": "🌀", "imagen": "washtower.jpg",
  "plantilla": "Informe de instalacion - WM.xlsx",
  "campos": { "TallerNombre": "B10", "NumeroSerie": "I16", ... },
  "slots": [ { "key": "serie", "label": "Nº Serie", "anchor": [colIni, filaIni, colFin, filaFin] } ]
}
```
- **`campos`**: nombre de campo → celda. Campos válidos (resueltos en `ExcelExportService.ValorCampo`):
  `TallerNombre, TecnicoResponsable, OrdenServicio, NumeroSerie, ClienteNombre, LugarInstalacion, ModeloProducto, Observaciones`.
- **`slots`**: fotos. `anchor = [colInicio, filaInicio, colFin, filaFin]` en **base 0**.
  - Regla de coordenadas: la foto llena el cuadro real de la plantilla. `filaInicio` (0-based) = fila Excel donde empieza la imagen (justo debajo de la etiqueta); `filaFin` = fila del borde inferior; `colFin` = última columna del cuadro **+1**.
  - Los anchors se derivaron leyendo los **bordes reales** de cada plantilla (no a ojo).

**Agregar un módulo nuevo = 0 código:** poner el `.xlsx` en `Templates/`, crear `Templates/config/{tipo}.json`,
(opcional) imagen en `frontend/img/` + registrarla en `frontend/src/services/modulos.js > IMAGENES`,
(opcional) añadir el tipo a `ordenPreferido` en `TemplateConfigService.cs` para su posición en el selector.

El frontend obtiene los módulos por **`GET /api/informes/modulos`** y los cachea en `services/modulos.js` (`useModulos`).

---

## 2. MAPA "quiero cambiar X → toca esto"

| Cambio | Archivo(s) |
|---|---|
| Celdas/anchors/etiquetas de una plantilla | `Templates/config/{tipo}.json` |
| Cómo se rellena un campo en Excel | `Services/ExcelExportService.cs` → `ValorCampo` |
| Cómo se posiciona/embebe la foto en Excel | `Services/ExcelExportService.cs` → `BuildAnchor` / `EmbedPhotos` |
| Carga/validación de configs | `Services/TemplateConfigService.cs` |
| Crear/guardar/finalizar/eliminar informe | `Services/InformeService.cs` |
| Endpoints de informes (crear, listar, exportar, eliminar, fotos, módulos) | `Controllers/InformesController.cs` |
| Auth (login, cambio pass, /me) | `Controllers/AuthController.cs` + `Services/AuthService.cs` |
| Config de arranque (JWT, CORS, rate-limit, secretos, middleware) | `Program.cs` |
| DTOs (request/response) | `DTOs/Dtos.cs` |
| Selector de módulos (tarjetas) | `frontend/src/pages/ModuleSelector.jsx` |
| Editor de informe (formulario + fotos) | `frontend/src/pages/InformeEditor.jsx` |
| Vista previa | `frontend/src/pages/InformePreview.jsx` |
| Lista de informes + eliminar | `frontend/src/pages/InformesList.jsx` |
| Subir/mostrar foto (slot) | `frontend/src/components/FotoSlot.jsx` + `components/AuthImage.jsx` |
| Sesión/login (contexto auth) | `frontend/src/hooks/useAuth.jsx` |
| Cliente HTTP / métodos API | `frontend/src/services/api.js` |
| Módulos (fetch + cache) | `frontend/src/services/modulos.js` |

---

## 3. CORRER Y PROBAR EN LOCAL (sin tocar producción)

- **Base de datos aislada (SQLite):** correr el backend con estas variables de entorno para NO usar la BD real:
  ```
  Database__Provider=Sqlite
  ConnectionStrings__conectionSql=Data Source=<ruta>/local.db
  ASPNETCORE_ENVIRONMENT=Development
  cd backend/InformesTecnicos.Api && dotnet run
  ```
  Credenciales demo (seed): `tecnico@empresa.com / tecnico123`, `admin@empresa.com / admin123`.
- **Frontend apuntando a local:** existe `frontend/.env.local` que fija `VITE_API_URL` al backend **remoto**.
  Para pruebas locales está **renombrado a `.env.local.bak`** → así dev usa `/api` (proxy a `localhost:5000`).
  Para volver a producción: `mv .env.local.bak .env.local`.
- Backend local escucha en `http://localhost:5000`; frontend dev en `http://localhost:5173`.
- Nota Windows: si `dotnet build` da error de "archivo bloqueado", es porque el backend local sigue corriendo; detener el proceso del puerto 5000 y recompilar.

---

## 4. SEGURIDAD — estado actual

**Ya aplicado:**
- Secretos fuera del repo: `Jwt:Key` (rotada) y cadena de conexión viven en `appsettings.Secrets.json` (gitignored)
  o en variables de entorno `Jwt__Key` / `ConnectionStrings__conectionSql`. Plantilla: `appsettings.Secrets.example.json`.
  Carga en `Program.cs` (AddJsonFile secrets + AddEnvironmentVariables).
- Swagger **solo en Development** (`Program.cs`).
- Fotos **privadas**: `/uploads` ya NO es estático público. Se sirven por `GET /api/informes/{id}/fotos/{fotoId}/imagen`
  (autenticado, técnico solo las suyas / admin todas). Frontend las carga con `components/AuthImage.jsx` (blob con token).
- Sesión: `useAuth.jsx` valida expiración del token al cargar (`tokenVencido`) → ya no "parpadea" a login.
- Eliminar informe con permisos (`InformeService.EliminarAsync`, `DELETE /api/informes/{id}`).

**Pendiente (opcional):**
- [ ] **Restringir CORS**: hoy `Program.cs` usa `AllowAnyOrigin()`. Falta la **URL pública del frontend** para limitarlo.
- [ ] **Rate-limit en toda la API**: el limiter "api" existe pero solo login está limitado. Aplicar a los controllers.
- [ ] **Rotar contraseña de la BD** en MonsterASP (quedó en el historial de Git) y setear `Jwt__Key` en el hosting.
- [ ] **CSP header** y ocultar detalles de error en producción.

---

## 5. BACKLOG (ideas discutidas, no implementadas)

- [ ] **Ajuste de imágenes**: hoy se **estiran** para llenar el cuadro (`BuildAnchor` usa `stretch/fillRect`, sin `srcRect`).
  Alternativas si se pide: "contain" (deja franjas) o "cover" (recorte centrado con `srcRect`). Decisión del usuario: **estirar** (elegido).
- [ ] **OCR de etiqueta → autollenar modelo/serie**: mejor opción = leer **código de barras** (ZXing) en el cliente; OCR (Tesseract.js) como respaldo. Reto: distinguir modelo vs serie (regex/anclas "Model"/"S/N").
- [ ] **Importar archivo con datos del cliente (autollenar)**: depende del formato de origen (Excel/CSV fiable, PDF menos, o buscar por RNN si hay fuente de datos).
- [ ] **Sesión en equipos compartidos**: hoy persiste hasta 8h (localStorage). Opciones: sessionStorage (cierra al cerrar navegador) o auto-cierre por inactividad. Usuario eligió **dejar 8h** por ahora.

---

## 6. DESPLIEGUE

- Frontend: GitHub Pages, base path `/Electronic_sys/` (ver `vite.config.js`). Build: `npm run build`.
  API en prod: `VITE_API_URL` de `.env.production` = `https://electronicshoptech.runasp.net/api`.
- Backend: **MonsterASP / runasp.net**. ⚠️ **El backend de producción tiene código viejo**: los cambios recientes
  (módulos nuevos, /modulos, eliminar, fotos protegidas, etc.) **no están desplegados** hasta que se publique.
  Al publicar: subir también `appsettings.Secrets.json` **o** setear las variables de entorno en el panel.

---

## 7. MODELO DE DATOS (resumen)

`Usuarios (1)─→(N) Informes (1)─→(N) Fotos`
- Informe: código `INF-YYYY-#####`, estado `borrador|finalizado`, `TipoServicio` (fijo al crear), `FormaPago` (solo web, no se exporta).
- `Usuario.Rol` = `Admin | Tecnico`. Admin ve todo; Técnico solo lo suyo.
- `Foto.Slot` = key del slot (validado contra el config del tipo, `TemplateConfigService.SlotValido`).
