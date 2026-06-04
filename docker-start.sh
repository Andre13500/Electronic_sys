#!/bin/sh
# =============================================================================
# SCRIPT DE ARRANQUE EN DOCKER — InformesTecnicos LG Electronics
#
# Este script se ejecuta al iniciar el contenedor en producción (Render).
# Responsabilidades:
#   1. Preparar el directorio de datos persistente (disco de Render)
#   2. Redirigir /app/uploads al disco persistente mediante symlink
#   3. Arrancar el backend .NET en segundo plano (puerto 5000)
#   4. Arrancar nginx en primer plano (puerto 10000, proceso principal)
#
# ┌─ NOTA SOBRE PERSISTENCIA ─────────────────────────────────────────────────┐
# │  Plan FREE de Render: almacenamiento efímero. La base de datos y fotos    │
# │  se pierden en cada redeploy. Funciona para pruebas.                      │
# │                                                                            │
# │  Para producción real: activa un "Disk" en Render montado en /data.       │
# │  Ver render.yaml → sección "disk". Requiere plan de pago (~$7/mes).       │
# └────────────────────────────────────────────────────────────────────────────┘
# =============================================================================

set -e  # Detener si cualquier comando falla con error

echo "==> [docker-start] Iniciando InformesTecnicos LG..."

# ── 1. Crear directorio de datos persistente ─────────────────────────────────
# /data es el mountPath del disco de Render. Si no hay disco, es temporal.
mkdir -p /data/uploads
echo "==> /data/uploads listo."

# ── 2. Symlink /app/uploads → /data/uploads ──────────────────────────────────
# El backend guarda fotos en {ContentRootPath}/uploads = /app/uploads.
# Con el symlink, las fotos van al disco persistente y sobreviven redeployments.
if [ ! -L /app/uploads ]; then
    rm -rf /app/uploads          # Elimina el directorio vacío del primer arranque
    ln -s /data/uploads /app/uploads
    echo "==> Symlink /app/uploads -> /data/uploads creado."
fi

# ── 3. Arrancar backend .NET en segundo plano ────────────────────────────────
# ASPNETCORE_URLS=http://+:5000 le dice al backend que escuche en el puerto 5000.
# Este valor viene de las variables de entorno configuradas en render.yaml.
echo "==> Iniciando backend .NET (puerto 5000)..."
dotnet /app/InformesTecnicos.Api.dll &
DOTNET_PID=$!

# Pequeña pausa para que el backend termine de inicializar la BD antes que nginx
# reciba las primeras peticiones
sleep 4
echo "==> Backend PID=$DOTNET_PID listo."

# ── 4. Arrancar nginx en primer plano ────────────────────────────────────────
# "daemon off" hace que nginx NO se ponga en background, así Docker lo puede
# monitorear. Si nginx se cae, Render reinicia el contenedor automáticamente.
echo "==> Iniciando nginx (puerto 10000)..."
exec nginx -g "daemon off;"
