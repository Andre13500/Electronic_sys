import { useRef, useState } from 'react'
import { informesApi } from '../services/api'
import { useToast } from './Toast.jsx'
import AuthImage from './AuthImage.jsx'

export default function FotoSlot({ informeId, slot, etiqueta, foto, onChange }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const subir = async (file) => {
    if (!file) return
    setBusy(true)
    try {
      await informesApi.subirFoto(informeId, slot, file)
      await onChange()
      toast.success('Foto subida.')
    } catch (e) {
      toast.error('No se pudo subir la foto.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const eliminar = async (e) => {
    e.stopPropagation()
    if (!foto) return
    if (!confirm('¿Eliminar esta foto?')) return
    setBusy(true)
    try {
      await informesApi.eliminarFoto(informeId, foto.id)
      await onChange()
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-brand-600 text-center min-h-[28px] flex items-center justify-center whitespace-pre-line">
        {etiqueta}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="relative w-full aspect-[4/3] rounded-xl border-2 border-dashed border-warm-line bg-warm-card hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-brand-600/10 transition-colors flex items-center justify-center overflow-hidden group"
      >
        {busy && (
          <div className="absolute inset-0 bg-warm-card/80 flex items-center justify-center z-10 text-xs text-warm-mute">
            Subiendo...
          </div>
        )}
        {foto ? (
          <>
            <AuthImage path={foto.url} alt={etiqueta}
              className="w-full h-full object-cover" />
            <span onClick={eliminar}
              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/55 text-white text-xs flex items-center justify-center hover:bg-black/75 cursor-pointer">
              ✕
            </span>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent text-white text-[10px] py-1 text-center opacity-0 group-hover:opacity-100 transition-opacity">
              Toca para reemplazar
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-warm-mute">
            <svg className="w-7 h-7 mb-1" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M3 7a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
              <circle cx="12" cy="13" r="3.5"/>
            </svg>
            <span className="text-[11px]">Subir foto</span>
          </div>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        onChange={e => subir(e.target.files?.[0])} className="hidden" />
    </div>
  )
}
