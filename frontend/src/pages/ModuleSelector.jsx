import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { informesApi } from '../services/api'

// Importación directa de imágenes desde frontend/img/
// Para agregar un nuevo módulo: pon la imagen aquí y agrega un import
import washtowerImg from '../../img/washtower.jpg'
import refrigeradorImg from '../../img/refrigerador.jpg'

// ===== MÓDULOS DE SERVICIO =====
// Para agregar un nuevo módulo de servicio:
//   1. Importa la imagen arriba (import miModuloImg from '../../img/mimodulo.jpg')
//   2. Agrega un objeto en este array con: key, label, descripcion, imagen
//   3. En Models.cs (backend) > campo TipoServicio: documenta el nuevo valor
//   4. En InformeEditor.jsx > SLOTS_POR_TIPO: agrega los slots del nuevo módulo
//   5. En InformeService.cs (backend) > SlotsValidos: agrega nuevos slots si los hay
//   6. En InformesList.jsx > TIPO_BADGE: agrega el badge de color para el listado
//   7. En InformePreview.jsx > SLOTS_LABEL y TIPO_SERVICIO_LABEL: agrega etiquetas
const MODULES = [
  {
    key: 'washtower',
    label: 'WashTower',
    descripcion: 'Lavadora Torre LG',
    imagen: washtowerImg,
  },
  {
    key: 'refrigerador',
    label: 'Refrigeradora',
    descripcion: 'Refrigerador LG',
    imagen: refrigeradorImg,
  },
]

export default function ModuleSelector() {
  const nav = useNavigate()
  const [creando, setCreando] = useState(null)
  const [error, setError] = useState(null)

  const seleccionar = async (modulo) => {
    setCreando(modulo.key)
    setError(null)
    try {
      const { data } = await informesApi.crear(modulo.key)
      nav(`/informes/${data.id}`)
    } catch (e) {
      setError(e.response?.data?.error ?? 'No se pudo crear el informe')
      setCreando(null)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <button onClick={() => nav('/')} className="btn-ghost px-2 mb-3">← Volver</button>
        <h2 className="text-xl font-semibold text-warm-ink">Selecciona el tipo de servicio</h2>
        <p className="text-sm text-warm-mute mt-1">
          Elige el equipo para el que vas a generar el informe técnico.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
        {MODULES.map((mod) => (
          <ModuleCard
            key={mod.key}
            modulo={mod}
            loading={creando === mod.key}
            disabled={creando !== null}
            onClick={() => seleccionar(mod)}
          />
        ))}
      </div>
    </div>
  )
}

function ModuleCard({ modulo, loading, disabled, onClick }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  // Animación: hover = se levanta, click = baja un poco (efecto de presión)
  const getTransform = () => {
    if (pressed) return 'translateY(-4px) scale(0.985)'
    if (hovered) return 'translateY(-10px) scale(1.01)'
    return 'translateY(0) scale(1)'
  }

  const getShadow = () => {
    if (pressed) return '0 8px 20px rgba(0,0,0,0.2), 0 2px 8px rgba(165,0,52,0.15)'
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
        {/* Imagen con altura fija */}
        <div className="relative h-64 overflow-hidden">
          <img
            src={modulo.imagen}
            alt={modulo.label}
            className="w-full h-full object-cover"
            style={{
              transform: hovered ? 'scale(1.06)' : 'scale(1)',
              transition: 'transform 0.5s ease',
            }}
          />

          {/* Degradado: negro abajo → rojo LG en el centro → oscuro arriba */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(165,0,52,0.4) 40%, rgba(20,20,20,0.25) 100%)',
            }}
          />

          {/* Brillo sutil en hover */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 55%)',
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          />

          {/* Borde rojo LG en hover */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              boxShadow: `inset 0 0 0 2px rgba(165,0,52,${hovered ? '0.6' : '0'})`,
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
                  <span>Crear informe</span>
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
