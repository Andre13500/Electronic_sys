# =============================================================================
# DOCKERFILE — InformesTecnicos LG Electronics
# Construcción en 3 etapas: compila el frontend, compila el backend
# y genera una imagen final ligera con nginx + .NET runtime.
# =============================================================================

# -----------------------------------------------------------------------------
# ETAPA 1: Compilar el frontend React (Node.js)
# Usamos alpine para mantener la imagen de compilación lo más pequeña posible.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Copiar SOLO los archivos de dependencias primero.
# Docker cachea esta capa; si package.json no cambia, npm ci no se repite.
COPY frontend/package*.json ./
RUN npm ci --silent

# Ahora copiar el resto del código fuente del frontend
COPY frontend/ ./

# Compilar para producción → genera la carpeta dist/
RUN npm run build


# -----------------------------------------------------------------------------
# ETAPA 2: Compilar el backend .NET 8
# Usamos la imagen SDK (más pesada, contiene compilador); el resultado
# se copiará a la imagen final sin llevar el SDK.
# -----------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-build

WORKDIR /app/backend

# Copiar el .csproj y restaurar NuGet primero (cacheable)
COPY backend/InformesTecnicos.Api/InformesTecnicos.Api.csproj ./
RUN dotnet restore

# Copiar el resto del código fuente del backend
COPY backend/InformesTecnicos.Api/ ./

# Publicar en modo Release — genera binarios optimizados en /app/publish
RUN dotnet publish -c Release -o /app/publish


# -----------------------------------------------------------------------------
# ETAPA 3: Imagen final — runtime ligero (.NET ASP.NET + nginx)
# Esta es la imagen que se sube a Render. Sin SDK, sin node_modules.
# -----------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:8.0

# Instalar nginx para servir el frontend y hacer proxy a la API
RUN apt-get update && apt-get install -y --no-install-recommends nginx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Copiar el backend compilado ──────────────────────────────────────────────
COPY --from=backend-build /app/publish .

# ── Copiar el frontend compilado (Vite → dist/) a la raíz de nginx ──────────
COPY --from=frontend-build /app/frontend/dist /var/www/html

# ── Copiar configuración de nginx ────────────────────────────────────────────
# La config sirve el frontend y proxea /api y /uploads al backend .NET
COPY nginx.conf /etc/nginx/sites-available/default

# ── Copiar el script de arranque que lanza nginx + .NET juntos ───────────────
# Se usa docker-start.sh (no start.sh, que es el script de desarrollo local)
COPY docker-start.sh /docker-start.sh
RUN chmod +x /docker-start.sh

# Render expone el puerto 10000 por defecto para servicios web.
# nginx escuchará en este puerto (configurado en nginx.conf).
EXPOSE 10000

# Punto de entrada: el script de arranque gestiona ambos procesos
CMD ["/docker-start.sh"]
