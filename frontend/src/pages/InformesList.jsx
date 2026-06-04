import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { informesApi } from '../services/api'

const fmtFecha = (d) => new Date(d).toLocaleDateString('es-EC', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
})

// Etiquetas de forma de pago (solo web, no se exporta)
const FORMA_PAGO_BADGE = {
  efectivo:      { label: 'Efectivo',      cls: 'bg-green-50 text-green-700' },
  transferencia: { label: 'Transferencia', cls: 'bg-blue-50 text-blue-700' },
  free:          { label: 'Free',          cls: 'bg-purple-50 text-purple-700' },
}

// Etiquetas de tipo de servicio
// Para agregar un nuevo tipo: agrega una entrada aquí y en ModuleSelector.jsx > MODULES
const TIPO_BADGE = {
  washtower:    { label: 'WashTower',    cls: 'bg-brand-50 text-brand-700' },
  refrigerador: { label: 'Refrigeradora', cls: 'bg-cyan-50 text-cyan-700' },
}

export default function InformesList() {
  const nav = useNavigate()
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = async (query) => {
    setLoading(true)
    try {
      const { data } = await informesApi.listar(query)
      setItems(data)
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar('') }, [])

  useEffect(() => {
    const t = setTimeout(() => cargar(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div>
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-semibold text-warm-ink">Mis informes</h2>
          <p className="text-sm text-warm-mute mt-0.5">Crea, continúa o exporta tus informes.</p>
        </div>
        {/* "Nuevo informe" abre el selector de módulo en vez de crear directamente */}
        <button onClick={() => nav('/nuevo-informe')} className="btn-primary">
          + Nuevo informe
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">
          {error}
        </div>
      )}

      {/* Buscador */}
      <div className="card p-3 mb-4">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-warm-mute"
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por técnico, máquina (modelo), serie o cliente..."
            className="input pl-9"
          />
        </div>
      </div>

      {/* Listado */}
      {loading ? (
        <div className="text-warm-mute text-sm py-12 text-center">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-warm-mute mb-3">No hay informes todavía.</div>
          <button onClick={() => nav('/nuevo-informe')} className="btn-primary">+ Crear el primero</button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(it => {
            const tipoBadge = TIPO_BADGE[it.tipoServicio]
            const pagoBadge = FORMA_PAGO_BADGE[it.formaPago]
            return (
              <div key={it.id} className="card p-4 hover:border-brand-200 hover:bg-brand-50/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-warm-ink text-sm">{it.codigo}</span>
                      <span className={`badge-${it.estado}`}>{it.estado}</span>
                      {tipoBadge && (
                        <span className={`badge ${tipoBadge.cls}`}>{tipoBadge.label}</span>
                      )}
                      {/* Forma de pago: solo visible en web, NO se exporta */}
                      {pagoBadge && (
                        <span className={`badge ${pagoBadge.cls}`}>{pagoBadge.label}</span>
                      )}
                    </div>
                    <div className="text-sm text-warm-ink">
                      {it.clienteNombre || <span className="text-warm-mute italic">Sin cliente</span>}
                    </div>
                    <div className="text-xs text-warm-mute mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>👤 {it.tecnicoNombre}</span>
                      {it.modeloProducto && <span>🔧 {it.modeloProducto}</span>}
                      {it.numeroSerie && <span>🔢 {it.numeroSerie}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-2">
                    <div className="text-[11px] text-warm-mute">{fmtFecha(it.actualizadoEn)}</div>
                    {/* Botones de acción */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => nav(`/informes/${it.id}/preview`)}
                        className="btn-ghost text-xs px-2 py-1"
                        title="Vista previa"
                      >
                        👁 Vista
                      </button>
                      <button
                        onClick={() => nav(`/informes/${it.id}`)}
                        className="btn-secondary text-xs px-2 py-1"
                        title="Editar informe"
                      >
                        ✏️ Editar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
