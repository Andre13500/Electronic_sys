import { createContext, useContext, useCallback, useState } from 'react'

const Ctx = createContext(null)

const ICONS = {
  success: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4M12 8h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
}

const STYLES = {
  success: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300',
  error:   'text-red-600 bg-red-50 dark:bg-red-500/15 dark:text-red-300',
  info:    'text-brand-600 bg-brand-50 dark:bg-brand-600/20 dark:text-brand-200',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const show = useCallback((message, type = 'info', duration = 3200) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type }])
    if (duration > 0) window.setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  // Atajos de conveniencia
  const toast = {
    success: (m, d) => show(m, 'success', d),
    error:   (m, d) => show(m, 'error', d),
    info:    (m, d) => show(m, 'info', d),
    show,
    dismiss,
  }

  return (
    <Ctx.Provider value={toast}>
      {children}
      {/* Contenedor de toasts (esquina inferior derecha) */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[calc(100vw-2rem)] w-80 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="card-glass shadow-lift px-3.5 py-3 flex items-start gap-3 animate-toast-in pointer-events-auto"
            role="status"
          >
            <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${STYLES[t.type]}`}>
              {ICONS[t.type]}
            </span>
            <p className="text-sm text-warm-ink flex-1 leading-snug pt-0.5">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-warm-mute hover:text-warm-ink transition-colors"
              aria-label="Cerrar"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast fuera de ToastProvider')
  return v
}
