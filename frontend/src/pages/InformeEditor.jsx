import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { informesApi } from '../services/api'
import { useModulos } from '../services/modulos'
import FotoSlot from '../components/FotoSlot.jsx'
import { useToast } from '../components/Toast.jsx'
import { Skeleton } from '../components/ui.jsx'

// Campos que se normalizan a MAYÚSCULAS y sin espacios sobrantes
const CAMPOS_MAYUSCULAS = ['ordenServicio', 'numeroSerie', 'modeloProducto']

// Los slots de fotos y las etiquetas por tipo YA NO se hardcodean aquí: se
// obtienen del backend (Templates/config/*.json) vía useModulos().

// Opciones de forma de pago (solo se guarda en web, NO va a la exportación)
// Para agregar más opciones: añade una entrada aquí
const FORMAS_PAGO = [
  { value: '', label: 'Sin especificar' },
  { value: 'efectivo', label: '💵 Efectivo' },
  { value: 'transferencia', label: '🏦 Transferencia' },
  { value: 'free', label: '🎁 Free (Gratuito)' },
]

export default function InformeEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { porTipo } = useModulos()
  const [informe, setInforme] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [exporting, setExporting] = useState(null)
  const [confirmFinalizar, setConfirmFinalizar] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const debounceRef = useRef(null)

  const cargar = async () => {
    const { data } = await informesApi.obtener(id)
    setInforme(data)
    if (!form) {
      setForm({
        tallerNombre:       data.tallerNombre || '',
        tecnicoResponsable: data.tecnicoResponsable || '',
        ordenServicio:      data.ordenServicio || '',
        numeroSerie:        data.numeroSerie || '',
        clienteNombre:      data.clienteNombre || '',
        lugarInstalacion:   data.lugarInstalacion || '',
        modeloProducto:     data.modeloProducto || '',
        observaciones:      data.observaciones || '',
        formaPago:          data.formaPago || '',
      })
    }
  }

  useEffect(() => { cargar() }, [id])

  // Autoguardado con debounce de 800ms
  useEffect(() => {
    if (!form || !informe) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        // Limpieza final de espacios en los campos en mayúsculas antes de persistir
        const payload = { ...form }
        for (const k of CAMPOS_MAYUSCULAS) if (payload[k]) payload[k] = payload[k].trim()
        await informesApi.guardar(id, payload)
        setSavedAt(new Date())
      } catch {
        toast.error('No se pudo guardar automáticamente.')
      } finally { setSaving(false) }
    }, 800)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [form])

  // Actualiza un campo. Los campos de CAMPOS_MAYUSCULAS se convierten a
  // mayúsculas y se les quitan los espacios iniciales mientras se escribe.
  const upd = (k, v) => {
    const val = CAMPOS_MAYUSCULAS.includes(k) ? v.toUpperCase().replace(/^\s+/, '') : v
    setForm(f => ({ ...f, [k]: val }))
  }

  const exportar = async (formato) => {
    setExporting(formato)
    try {
      await informesApi.descargar(id, formato)
      toast.success('Plantilla exportada correctamente.')
    }
    catch (e) {
      let msg = 'No se pudo exportar'
      try {
        const text = e.response?.data instanceof Blob
          ? await e.response.data.text()
          : JSON.stringify(e.response?.data)
        const json = JSON.parse(text)
        if (json?.error) msg = json.error
      } catch {}
      toast.error(msg)
    }
    finally { setExporting(null) }
  }

  const finalizar = async () => {
    setFinalizando(true)
    try {
      await informesApi.finalizar(id)
      await cargar()
      setConfirmFinalizar(false)
      toast.success('Informe finalizado.')
    } catch {
      toast.error('Error al finalizar el informe.')
    } finally {
      setFinalizando(false)
    }
  }

  if (!form || !informe) return <EditorSkeleton />

  // Los slots y la etiqueta del tipo vienen de la config del backend (useModulos).
  // Mientras carga, se muestra una cuadrícula vacía; al llegar se puebla sola.
  const modulo = porTipo[informe.tipoServicio]
  const slots = modulo?.slots ?? []
  const tipoLabel = modulo?.label ?? informe.tipoServicio

  const fotoOf = (slot) => {
    const f = informe.fotos.find(x => x.slot === slot)
    return f ? { id: f.id, url: f.url } : null
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => nav('/')} className="btn-ghost px-2">← Volver</button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-warm-ink">{informe.codigo}</span>
              <span className={`badge-${informe.estado}`}>{informe.estado}</span>
              <span className="badge bg-brand-50 text-brand-700">{tipoLabel}</span>
            </div>
            <div className="text-[11px] text-warm-mute">
              {saving ? 'Guardando...' : savedAt ? `Guardado · ${savedAt.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}` : ' '}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Vista previa */}
          <button
            onClick={() => nav(`/informes/${id}/preview`)}
            className="btn-ghost"
          >
            👁 Vista previa
          </button>
          <button onClick={() => exportar('xlsx')} disabled={exporting !== null} className="btn-secondary">
            {exporting === 'xlsx' ? 'Generando...' : '📊 Exportar plantilla'}
          </button>
        </div>
      </div>

      {/* Datos del Taller */}
      {/* tallerNombre se pre-llena con "Electronic Shop" al crear el informe (ver InformeService.cs) */}
      {/* tecnicoResponsable se pre-llena con el nombre del técnico logueado */}
      <Section titulo="Datos del Taller">
        <Row>
          <Field
            label="Nombre del Taller"
            value={form.tallerNombre}
            onChange={v => upd('tallerNombre', v)}
            placeholder="Electronic Shop"
            hint="Pre-llenado automáticamente"
          />
          <Field
            label="Técnico Responsable"
            value={form.tecnicoResponsable}
            onChange={v => upd('tecnicoResponsable', v)}
            placeholder="Nombre del técnico"
            hint="Pre-llenado con tu nombre de usuario"
          />
        </Row>
      </Section>

      {/* Datos del Cliente */}
      <Section titulo="Datos del Cliente">
        <Row>
          <Field label="Orden de Servicio (RNN)"
            value={form.ordenServicio}
            onChange={v => upd('ordenServicio', v)}
            placeholder="Ej: RNN260411011353" upper />
          <Field label="Número de Serie"
            value={form.numeroSerie}
            onChange={v => upd('numeroSerie', v)}
            placeholder="Ej: 509TRVM8N495" upper />
        </Row>
        <Field label="Nombre del Cliente"
          value={form.clienteNombre}
          onChange={v => upd('clienteNombre', v)} />
        <Field label="Lugar de la Instalación"
          value={form.lugarInstalacion}
          onChange={v => upd('lugarInstalacion', v)}
          placeholder="Ej: COCINA" />
        <Field label="Modelo del Producto"
          value={form.modeloProducto}
          onChange={v => upd('modeloProducto', v)}
          placeholder="Ej: WK25GGS6E" upper />
      </Section>

      {/* Forma de Pago — solo web, NO se exporta a la plantilla */}
      <Section titulo="Información de Pago">
        <div>
          <label className="label">Forma de Pago</label>
          <p className="text-[10px] text-warm-mute mb-1.5">
            Esta información es solo para registro interno. No aparece en la exportación Excel/PDF.
          </p>
          <div className="flex flex-wrap gap-2">
            {FORMAS_PAGO.map(op => (
              <button
                key={op.value}
                type="button"
                onClick={() => upd('formaPago', op.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.formaPago === op.value
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-warm-card text-warm-ink border-warm-line hover:border-brand-300'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Fotos del Servicio — slots según tipo de servicio */}
      <Section
        titulo={`Fotos del Servicio · ${tipoLabel}`}
        descripcion="Sube las fotos en sus posiciones correctas. Cada foto se ubicará automáticamente en el informe oficial."
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {slots.map(s => (
            <FotoSlot
              key={s.key}
              informeId={id}
              slot={s.key}
              etiqueta={s.label}
              foto={fotoOf(s.key)}
              onChange={cargar}
            />
          ))}
        </div>
      </Section>

      {/* Observaciones */}
      <Section titulo="Observaciones (opcional)">
        <textarea
          value={form.observaciones}
          onChange={e => upd('observaciones', e.target.value)}
          rows={4}
          className="input resize-none"
          placeholder="Notas adicionales sobre la instalación..."
        />
      </Section>

      {informe.estado === 'borrador' && (
        <div className="flex justify-end pt-2">
          <button onClick={() => setConfirmFinalizar(true)} className="btn-primary">Finalizar informe</button>
        </div>
      )}

      {/* Confirmación de finalizar (sin diálogo nativo bloqueante) */}
      {confirmFinalizar && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => !finalizando && setConfirmFinalizar(false)}>
          <div className="card-glass shadow-lift w-full max-w-sm p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-600/15 text-brand-600 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
            </div>
            <h3 className="font-semibold text-warm-ink">Finalizar informe</h3>
            <p className="text-sm text-warm-mute mt-1">Una vez finalizado, el informe quedará marcado como completado. ¿Deseas continuar?</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmFinalizar(false)} disabled={finalizando} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={finalizar} disabled={finalizando} className="btn-primary flex-1">
                {finalizando ? 'Finalizando…' : 'Sí, finalizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-9 w-44" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  )
}

// --- helpers ---

function Section({ titulo, descripcion, children }) {
  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-brand-600">{titulo}</h3>
        {descripcion && <p className="text-xs text-warm-mute mt-1">{descripcion}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Row({ children }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
}

function Field({ label, value, onChange, placeholder, hint, upper }) {
  // upper: el valor ya llega en mayúsculas desde upd(); al salir del campo se
  // recortan los espacios sobrantes (inicio y final).
  const onBlur = upper && value ? () => onChange(value.trim()) : undefined
  return (
    <div>
      <label className="label">{label}</label>
      {hint && <p className="text-[10px] text-warm-mute mb-1">{hint}</p>}
      <input
        className={`input ${upper ? 'uppercase tracking-wide' : ''}`}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
      />
    </div>
  )
}
