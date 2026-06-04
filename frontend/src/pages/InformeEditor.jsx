import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { informesApi } from '../services/api'
import FotoSlot from '../components/FotoSlot.jsx'

// ===== SLOTS POR TIPO DE SERVICIO =====
// Para agregar un nuevo tipo de servicio:
//   1. Agrega una entrada aquí con la key igual al TipoServicio del backend
//   2. Los nombres de slot deben existir en InformeService.cs > SlotsValidos (backend)
//   3. Si necesitas slots nuevos, agrégalos al array SlotsValidos en el backend
// Para modificar etiquetas de un tipo existente: solo edita el texto de 'etiqueta' aquí
const SLOTS_POR_TIPO = {
  washtower: [
    { slot: 'serie',        etiqueta: 'Nº Serie' },
    { slot: 'accesorios',   etiqueta: 'Accesorios\n(Manguera + Llave)' },
    { slot: 'presion',      etiqueta: 'Presión de Agua\n(0,5 ~ 8,0 kgf/cm²)' },
    { slot: 'alimentacion', etiqueta: 'Alimentación Eléctrica (220 V)' },
    { slot: 'nivelacion',   etiqueta: 'Nivelación' },
    { slot: 'equipo',       etiqueta: 'Foto del Equipo Instalado' },
  ],
  // Slots para Refrigeradora — ajusta etiquetas según el informe oficial
  refrigerador: [
    { slot: 'serie',        etiqueta: 'Nº Serie' },
    { slot: 'accesorios',   etiqueta: 'Instalación\n(Toma de agua)' },
    { slot: 'presion',      etiqueta: 'Temperatura\n(Configuración)' },
    { slot: 'alimentacion', etiqueta: 'Alimentación Eléctrica (220 V)' },
    { slot: 'nivelacion',   etiqueta: 'Nivelación' },
    { slot: 'equipo',       etiqueta: 'Foto del Equipo Instalado' },
  ],
}

const TIPO_LABEL = {
  washtower: 'WashTower',
  refrigerador: 'Refrigeradora',
}

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
  const [informe, setInforme] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [exporting, setExporting] = useState(null)
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
        await informesApi.guardar(id, form)
        setSavedAt(new Date())
      } finally { setSaving(false) }
    }, 800)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [form])

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const exportar = async (formato) => {
    setExporting(formato)
    try { await informesApi.descargar(id, formato) }
    catch (e) {
      let msg = 'No se pudo exportar'
      try {
        const text = e.response?.data instanceof Blob
          ? await e.response.data.text()
          : JSON.stringify(e.response?.data)
        const json = JSON.parse(text)
        if (json?.error) msg = json.error
      } catch {}
      alert(msg)
    }
    finally { setExporting(null) }
  }

  const finalizar = async () => {
    if (!confirm('¿Marcar informe como finalizado?')) return
    try {
      await informesApi.finalizar(id)
      await cargar()
    } catch { alert('Error al finalizar') }
  }

  if (!form || !informe) return <div className="text-warm-mute">Cargando...</div>

  // Seleccionar los slots según el tipo de servicio del informe
  // Si el tipo no está en SLOTS_POR_TIPO, usa washtower como fallback
  const slots = SLOTS_POR_TIPO[informe.tipoServicio] ?? SLOTS_POR_TIPO.washtower
  const tipoLabel = TIPO_LABEL[informe.tipoServicio] ?? informe.tipoServicio

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
            placeholder="Ej: RNN260411011353" />
          <Field label="Número de Serie"
            value={form.numeroSerie}
            onChange={v => upd('numeroSerie', v)}
            placeholder="Ej: 509TRVM8N495" />
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
          placeholder="Ej: WK25GGS6E" />
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
                    : 'bg-white text-warm-ink border-warm-line hover:border-brand-300'
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
              key={s.slot}
              informeId={id}
              slot={s.slot}
              etiqueta={s.etiqueta}
              foto={fotoOf(s.slot)}
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
          <button onClick={finalizar} className="btn-primary">Finalizar informe</button>
        </div>
      )}
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

function Field({ label, value, onChange, placeholder, hint }) {
  return (
    <div>
      <label className="label">{label}</label>
      {hint && <p className="text-[10px] text-warm-mute mb-1">{hint}</p>}
      <input className="input" value={value || ''}
        onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}
