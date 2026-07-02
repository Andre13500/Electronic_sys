import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { informesApi } from '../services/api'
import { useModulos, imagenDeModulo } from '../services/modulos'

// ===== SELECTOR DE MÓDULOS DE SERVICIO =====
// La lista de módulos es DINÁMICA: viene del backend (Templates/config/*.json)
// vía GET /api/informes/modulos. Para agregar un módulo nuevo NO se toca este
// archivo — basta crear el JSON de config (y, opcionalmente, una imagen que se
// registra en services/modulos.js > IMAGENES).
export default function ModuleSelector() {
  const nav = useNavigate()
  const { modulos, loading, error: errorCarga } = useModulos()
  const [creando, setCreando] = useState(null)
  const [error, setError] = useState(null)

  const seleccionar = async (modulo) => {
    setCreando(modulo.tipo)
    setError(null)
    try {
      const { data } = await informesApi.crear(modulo.tipo)
      nav(`/informes/${data.id}`)
    } catch (e) {
      setError(e.response?.data?.error ?? 'No se pudo crear el informe')
      setCreando(null)
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <button onClick={() => nav('/')} className="btn-ghost px-2 mb-3">← Volver</button>
        <h2 className="text-2xl font-bold text-warm-ink tracking-tight">Selecciona el tipo de servicio</h2>
        <p className="text-sm text-warm-mute mt-1">
          Elige el equipo para el que vas a generar el informe técnico.
        </p>
      </div>

      {(error || errorCarga) && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">
          {error || errorCarga}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-60 rounded-2xl skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl">
          {modulos.map((mod) => (
            <ModuleCard
              key={mod.tipo}
              modulo={mod}
              loading={creando === mod.tipo}
              disabled={creando !== null}
              onClick={() => seleccionar(mod)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ModuleCard({ modulo, loading, disabled, onClick }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const imagen = imagenDeModulo(modulo)

  // Animación: hover = se levanta, click = baja un poco (efecto de presión)
  const getTransform = () => {
    if (pressed) return 'translateY(-4px) scale(0.985)'
    if (hovered) return 'translateY(-10px) scale(1.01)'
    return 'translateY(0) scale(1)'
  }

  const getShadow = () => {
    if (pressed) return '0 8px 20px rgba(255, 40, 40, 0.88), 0 2px 8px rgba(255, 248, 54, 0.77)'
    if (hovered) return '0 25px 50px rgba(0,0,0,0.3), 0 8px 20px rgba(165,0,52,0.2)'
    return '0 4px 15px rgba(0,0,0,0.08)'
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false) }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onTouchStart={() => { setHovered(true); setPressed(true) }}
        onTouchEnd={() => { setPressed(false); setHovered(false) }}
        className="w-full rounded-2xl overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          transform: getTransform(),
          boxShadow: getShadow(),
          transition: pressed
            ? 'transform 0.1s ease, box-shadow 0.1s ease'
            : 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s ease',
        }}
      >
        {/* Imagen con altura fija (o degradado + icono si no hay imagen) */}
        <div className="relative h-60 overflow-hidden rounded-2xl">
          {imagen ? (
            <img
              src={imagen}
              alt={modulo.label}
              className="w-full h-full object-contain"
              style={{
                transform: hovered ? 'scale(1.00)' : 'scale(0.90)',
                transition: 'transform 0.7s ease',
              }}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #a50034 0%, #4a0018 100%)',
              }}
            >
              <span
                className="text-7xl"
                style={{
                  transform: hovered ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 0.5s ease',
                }}
              >
                {modulo.icono || '🔧'}
              </span>
            </div>
          )}

          {/* Degradado inferior para legibilidad del texto */}
          <div
            className="absolute inset-0"
            style={{
              background: imagen
                ? 'linear-gradient(to top, rgba(68, 230, 242, 0.63) 0%, rgba(175, 229, 251, 0.4) 40%, rgba(20,20,20,0.25) 100%)'
                : 'linear-gradient(to top, rgba(20,20,20,0.55) 0%, rgba(20,20,20,0.1) 45%, transparent 100%)',
            }}
          />

          {/* Brillo sutil en hover */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.49) 0%, transparent 55%)',
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          />

          {/* Borde rojo LG en hover */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              boxShadow: `inset 0px 0px 0 3px ${hovered ? '#d85252a2' : 'transparent'}`,
              transition: 'box-shadow 0.3s ease',
            }}
          />

          {/* Texto sobre la imagen */}
          <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
            {loading ? (
              <div className="flex items-center gap-2 text-white">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="font-medium">Creando informe...</span>
              </div>
            ) : (
              <>
                <div className="text-white/70 text-xs font-medium uppercase tracking-widest mb-1">
                  {modulo.descripcion}
                </div>
                <div className="text-white text-2xl font-bold leading-tight">
                  {modulo.label}
                </div>
                <div
                  className="mt-2 flex items-center gap-1 text-sm"
                  style={{
                    color: hovered ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.7)',
                    transition: 'color 0.3s ease',
                  }}
                >
                  <span>Generar informe</span>
                  <svg
                    className="w-4 h-4"
                    style={{
                      transform: hovered ? 'translateX(4px)' : 'translateX(0)',
                      transition: 'transform 0.3s ease',
                    }}
                    fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </>
            )}
          </div>
        </div>
      </button>

      {/* Nombre del servicio debajo de la tarjeta */}
      <div className="text-center">
        <span className="text-sm font-semibold text-warm-ink">{modulo.label}</span>
        <span className="text-xs text-warm-mute ml-2">{modulo.descripcion}</span>
      </div>
    </div>
  )
}
