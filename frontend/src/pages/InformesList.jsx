import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { informesApi } from '../services/api'
import { useModulos } from '../services/modulos'
import { EmptyState } from '../components/ui.jsx'
import { useToast } from '../components/Toast.jsx'
import { useAuth } from '../hooks/useAuth.jsx'

const fmtFecha = (d) => new Date(d).toLocaleDateString('es-EC', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
})

// Etiquetas de forma de pago (solo web, no se exporta)
const FORMA_PAGO_BADGE = {
  efectivo:      { label: 'Efectivo',      cls: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300' },
  transferencia: { label: 'Transferencia', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  free:          { label: 'Free',          cls: 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300' },
}

// Paleta de colores para el badge de tipo. La etiqueta del tipo es dinámica
// (viene de la config del backend); el color se asigna de forma determinística
// por tipo para mantener consistencia visual sin hardcodear cada módulo.
const TIPO_COLORES = [
  'bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-200',
  'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
]
const colorDeTipo = (tipo) => {
  let h = 0
  for (const c of (tipo || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TIPO_COLORES[h % TIPO_COLORES.length]
}

// Filtros rápidos por estado
const FILTROS = [
  { key: 'todos',      label: 'Todos' },
  { key: 'borrador',   label: 'Borradores' },
  { key: 'finalizado', label: 'Finalizados' },
]

export default function InformesList() {
  const nav = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const esAdmin = user?.rol === 'Admin'   // solo el Admin puede eliminar
  const { porTipo } = useModulos()
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [mostrarLista, setMostrarLista] = useState(true)
  const [confirmar, setConfirmar] = useState(null)   // informe a eliminar (o null)
  const [eliminando, setEliminando] = useState(false)
  const searchRef = useRef(null)

  const cargar = async (query) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await informesApi.listar(query)
      setItems(data)
    } catch {
      setError('No se pudieron cargar los informes.')
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar('') }, [])

  // Elimina el informe confirmado y actualiza la lista sin recargar todo.
  const eliminar = async () => {
    if (!confirmar) return
    setEliminando(true)
    try {
      await informesApi.eliminar(confirmar.id)
      setItems(prev => prev.filter(i => i.id !== confirmar.id))
      toast.success('Informe eliminado.')
      setConfirmar(null)
    } catch (e) {
      toast.error(e.response?.data?.error ?? 'No se pudo eliminar el informe.')
    } finally {
      setEliminando(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => cargar(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  // Atajo "/" para enfocar el buscador
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault(); searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Conteos por estado (sobre el resultado actual de búsqueda)
  const counts = useMemo(() => ({
    todos: items.length,
    borrador: items.filter(i => i.estado === 'borrador').length,
    finalizado: items.filter(i => i.estado === 'finalizado').length,
  }), [items])

  // Lista filtrada por estado
  const filtrados = useMemo(
    () => filtro === 'todos' ? items : items.filter(i => i.estado === filtro),
    [items, filtro]
  )

  // Actividad reciente: 3 más recientes (solo sin búsqueda activa)
  const recientes = useMemo(
    () => [...items].sort((a, b) => new Date(b.actualizadoEn) - new Date(a.actualizadoEn)).slice(0, 3),
    [items]
  )

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-warm-ink tracking-tight">Mis informes</h2>
          <p className="text-sm text-warm-mute mt-0.5">Crea, continúa o exporta tus informes técnicos.</p>
        </div>
        <button onClick={() => nav('/nuevo-informe')} className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
          Nuevo informe
        </button>
      </div>

      {/* Contadores tipo bento (también funcionan como filtros) */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total" value={counts.todos} active={filtro === 'todos'}
          onClick={() => setFiltro('todos')} accent="brand" loading={loading} />
        <StatCard label="Borradores" value={counts.borrador} active={filtro === 'borrador'}
          onClick={() => setFiltro('borrador')} accent="gray" loading={loading} />
        <StatCard label="Finalizados" value={counts.finalizado} active={filtro === 'finalizado'}
          onClick={() => setFiltro('finalizado')} accent="emerald" loading={loading} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300 text-sm rounded-xl px-4 py-2">
          {error}
        </div>
      )}

      {/* Buscador + filtros + toggle */}
      <div className="card p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-warm-mute"
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              ref={searchRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar por técnico, modelo, serie o cliente…   ( / )"
              className="input pl-9"
            />
          </div>
          <button
            onClick={() => setMostrarLista(m => !m)}
            className="btn-secondary shrink-0 whitespace-nowrap"
            title={mostrarLista ? 'Ocultar la lista de informes' : 'Mostrar la lista de informes'}
          >
            {mostrarLista ? '🙈 Ocultar' : '👁 Mostrar'}
          </button>
        </div>

        {/* Filtros rápidos */}
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filtro === f.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-warm-bg text-warm-mute hover:text-warm-ink border border-warm-line'
              }`}
            >
              {f.label} <span className="opacity-70">· {counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Contenido colapsable */}
      <div
        className={`transition-all duration-300 ${mostrarLista ? 'opacity-100' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'}`}
      >
        {/* Actividad reciente (solo sin búsqueda y sin filtro) */}
        {!loading && !q && filtro === 'todos' && recientes.length > 0 && (
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-warm-mute uppercase tracking-wide mb-2">Actividad reciente</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {recientes.map(it => (
                <button key={it.id} onClick={() => nav(`/informes/${it.id}`)}
                  className="card card-hover p-3 text-left">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-warm-ink truncate">{it.codigo}</span>
                    <span className={`badge-${it.estado}`}>{it.estado}</span>
                  </div>
                  <div className="text-sm text-warm-ink truncate">
                    {it.clienteNombre || <span className="text-warm-mute italic">Sin cliente</span>}
                  </div>
                  <div className="text-[11px] text-warm-mute mt-1">{fmtFecha(it.actualizadoEn)}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Listado */}
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : filtrados.length === 0 ? (
          items.length === 0 ? (
            <EmptyState
              icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-6 4h6M9 9h1M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /></svg>}
              title="No hay informes todavía"
              subtitle="Crea tu primer informe técnico para comenzar."
              action={<button onClick={() => nav('/nuevo-informe')} className="btn-primary">+ Crear el primero</button>}
            />
          ) : (
            <EmptyState
              icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4.3-4.3" /></svg>}
              title="Sin resultados"
              subtitle="Ningún informe coincide con la búsqueda o filtro actual."
            />
          )
        ) : (
          <div className="space-y-2.5">
            {filtrados.map(it => (
              <InformeCard key={it.id} it={it} nav={nav} porTipo={porTipo}
                onEliminar={esAdmin ? () => setConfirmar(it) : null} />
            ))}
          </div>
        )}
      </div>

      {/* Confirmación de eliminación — via portal a document.body para que el
          overlay 'fixed' cubra toda la pantalla y no lo descoloque el transform
          del contenedor con animación (animate-fade-up). */}
      {confirmar && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => !eliminando && setConfirmar(null)}>
          <div className="card-glass shadow-lift w-full max-w-sm p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/15 text-red-600 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="font-semibold text-warm-ink">Eliminar informe</h3>
            <p className="text-sm text-warm-mute mt-1">
              Se eliminará <span className="font-medium text-warm-ink">{confirmar.codigo}</span>
              {confirmar.clienteNombre ? ` (${confirmar.clienteNombre})` : ''} y todas sus fotos.
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmar(null)} disabled={eliminando} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={eliminar} disabled={eliminando}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
                {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

const ACCENTS = {
  brand:   'text-brand-600',
  gray:    'text-gray-500 dark:text-gray-300',
  emerald: 'text-emerald-600 dark:text-emerald-400',
}

function StatCard({ label, value, active, onClick, accent, loading }) {
  return (
    <button
      onClick={onClick}
      className={`card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift ${
        active ? 'ring-2 ring-brand-500/40 border-brand-200' : ''
      }`}
    >
      <div className="text-[11px] font-medium text-warm-mute uppercase tracking-wide">{label}</div>
      {loading
        ? <div className="skeleton h-7 w-10 mt-1.5" />
        : <div className={`text-2xl font-bold mt-0.5 ${ACCENTS[accent]}`}>{value}</div>}
    </button>
  )
}

function InformeCard({ it, nav, porTipo, onEliminar }) {
  const modulo = porTipo?.[it.tipoServicio]
  const tipoBadge = it.tipoServicio
    ? { label: modulo?.label ?? it.tipoServicio, cls: colorDeTipo(it.tipoServicio) }
    : null
  const pagoBadge = FORMA_PAGO_BADGE[it.formaPago]
  return (
    <div className="card card-hover p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="font-semibold text-warm-ink text-sm">{it.codigo}</span>
            <span className={`badge-${it.estado}`}>{it.estado}</span>
            {tipoBadge && <span className={`badge ${tipoBadge.cls}`}>{tipoBadge.label}</span>}
            {pagoBadge && <span className={`badge ${pagoBadge.cls}`}>{pagoBadge.label}</span>}
          </div>
          <div className="text-base font-medium text-warm-ink truncate">
            {it.clienteNombre || <span className="text-warm-mute italic font-normal">Sin cliente</span>}
          </div>
          <div className="text-xs text-warm-mute mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1">👤 {it.tecnicoNombre}</span>
            {it.modeloProducto && <span className="inline-flex items-center gap-1">🔧 {it.modeloProducto}</span>}
            {it.numeroSerie && <span className="inline-flex items-center gap-1">🔢 {it.numeroSerie}</span>}
          </div>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-2">
          <div className="text-[11px] text-warm-mute">{fmtFecha(it.actualizadoEn)}</div>
          <div className="flex gap-1">
            <button onClick={() => nav(`/informes/${it.id}/preview`)}
              className="btn-ghost text-xs px-2 py-1" title="Vista previa">👁 Vista</button>
            <button onClick={() => nav(`/informes/${it.id}`)}
              className="btn-secondary text-xs px-2 py-1" title="Editar informe">✏️ Editar</button>
            {onEliminar && (
              <button onClick={onEliminar}
                className="btn-ghost text-xs px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                title="Eliminar informe">🗑</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-5 w-56" />
          <div className="skeleton h-3 w-64" />
        </div>
        <div className="space-y-2 flex flex-col items-end">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-7 w-32" />
        </div>
      </div>
    </div>
  )
}
