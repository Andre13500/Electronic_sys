import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { informesApi } from '../services/api'
import { useModulos } from '../services/modulos'
import { useToast } from '../components/Toast.jsx'
import AuthImage from '../components/AuthImage.jsx'

const fmtFecha = (d) => new Date(d).toLocaleDateString('es-EC', {
  day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
})

// Etiquetas de forma de pago para mostrar
const FORMA_PAGO_LABEL = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  free: 'Gratuito (Free)',
}

// Las etiquetas de tipo y de slots vienen de la config del backend (useModulos).

export default function InformePreview() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { porTipo } = useModulos()
  const [informe, setInforme] = useState(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    informesApi.obtener(id).then(({ data }) => setInforme(data))
  }, [id])

  const exportar = async () => {
    setExporting(true)
    try {
      await informesApi.descargar(id, 'xlsx')
      toast.success('Plantilla exportada correctamente.')
    } catch {
      toast.error('No se pudo exportar la plantilla.')
    } finally {
      setExporting(false)
    }
  }

  if (!informe) return <div className="text-warm-mute">Cargando...</div>

  const modulo = porTipo[informe.tipoServicio]
  const slots = modulo?.slots ?? []
  const tipoLabel = modulo?.label ?? informe.tipoServicio
  const fotoOf = (slot) => {
    const f = informe.fotos.find(f => f.slot === slot)
    return f ? { ...f, url: f.url } : undefined
  }

  return (
    <div className="space-y-5 max-w-3xl animate-fade-up">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => nav(`/informes/${id}`)} className="btn-ghost px-2">← Editar</button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-warm-ink">{informe.codigo}</span>
              <span className={`badge-${informe.estado}`}>{informe.estado}</span>
              <span className="badge bg-blue-50 text-blue-700">{tipoLabel}</span>
            </div>
            <div className="text-[11px] text-warm-mute">Vista previa del informe</div>
          </div>
        </div>
        <button onClick={exportar} disabled={exporting} className="btn-primary">
          {exporting ? 'Generando…' : '📊 Exportar plantilla'}
        </button>
      </div>

      {/* Forma de pago — solo visible en web */}
      {informe.formaPago && (
        <div className="card p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
            informe.formaPago === 'efectivo' ? 'bg-green-100' :
            informe.formaPago === 'transferencia' ? 'bg-blue-100' : 'bg-purple-100'
          }`}>
            {informe.formaPago === 'efectivo' ? '💵' :
             informe.formaPago === 'transferencia' ? '🏦' : '🎁'}
          </div>
          <div>
            <div className="text-xs text-warm-mute">Forma de pago</div>
            <div className="font-semibold text-warm-ink">{FORMA_PAGO_LABEL[informe.formaPago] ?? informe.formaPago}</div>
          </div>
        </div>
      )}

      {/* Datos del taller */}
      <PreviewSection titulo="Datos del Taller">
        <div className="grid grid-cols-2 gap-4">
          <PreviewField label="Nombre del Taller" value={informe.tallerNombre} />
          <PreviewField label="Técnico Responsable" value={informe.tecnicoResponsable} />
        </div>
      </PreviewSection>

      {/* Datos del cliente */}
      <PreviewSection titulo="Datos del Cliente">
        <div className="grid grid-cols-2 gap-4">
          <PreviewField label="Orden de Servicio" value={informe.ordenServicio} />
          <PreviewField label="Número de Serie" value={informe.numeroSerie} />
        </div>
        <PreviewField label="Nombre del Cliente" value={informe.clienteNombre} />
        <div className="grid grid-cols-2 gap-4">
          <PreviewField label="Lugar de Instalación" value={informe.lugarInstalacion} />
          <PreviewField label="Modelo del Producto" value={informe.modeloProducto} />
        </div>
      </PreviewSection>

      {/* Fotos */}
      <PreviewSection titulo={`Fotos del Servicio · ${tipoLabel}`}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {slots.map(({ key: slot, label: etiqueta }) => {
            const foto = fotoOf(slot)
            return (
              <div key={slot} className="border border-warm-line rounded-xl overflow-hidden">
                {foto ? (
                  <AuthImage
                    path={foto.url}
                    alt={etiqueta}
                    className="w-full h-36 object-cover"
                  />
                ) : (
                  <div className="w-full h-36 bg-warm-bg flex items-center justify-center">
                    <span className="text-warm-mute text-xs">Sin foto</span>
                  </div>
                )}
                <div className="px-2 py-1.5 bg-warm-card border-t border-warm-line">
                  <p className="text-[10px] text-warm-mute leading-tight">{etiqueta}</p>
                </div>
              </div>
            )
          })}
        </div>
      </PreviewSection>

      {/* Observaciones */}
      {informe.observaciones && (
        <PreviewSection titulo="Observaciones">
          <p className="text-sm text-warm-ink whitespace-pre-wrap">{informe.observaciones}</p>
        </PreviewSection>
      )}

      {/* Pie */}
      <div className="text-xs text-warm-mute text-right">
        Creado: {fmtFecha(informe.creadoEn)} · Actualizado: {fmtFecha(informe.actualizadoEn)}
      </div>
    </div>
  )
}

function PreviewSection({ titulo, children }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-brand-600 mb-4">{titulo}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function PreviewField({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-warm-mute uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-sm text-warm-ink">{value || <span className="text-warm-mute italic">Sin datos</span>}</div>
    </div>
  )
}
