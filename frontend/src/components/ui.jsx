// Componentes de interfaz reutilizables (DRY) usados en toda la app.

// Devuelve las iniciales (máx. 2) a partir de un nombre.
export function initials(nombre = '') {
  const parts = nombre.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Avatar circular con iniciales. size: 'sm' | 'md' | 'lg'
export function Avatar({ nombre, size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-16 h-16 text-xl',
  }
  return (
    <div
      className={`${sizes[size]} ${className} shrink-0 rounded-full flex items-center justify-center
                  font-semibold text-white bg-gradient-to-br from-brand-500 to-brand-700
                  shadow-sm select-none ring-2 ring-white/40 dark:ring-white/10`}
      aria-hidden="true"
    >
      {initials(nombre)}
    </div>
  )
}

// Bloque de skeleton (carga). Pasa clases de tamaño por className.
export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />
}

// Estado vacío reutilizable.
export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="card p-12 text-center animate-fade-up">
      {icon && (
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-brand-50 dark:bg-brand-600/15 text-brand-600 flex items-center justify-center">
          {icon}
        </div>
      )}
      <div className="font-semibold text-warm-ink">{title}</div>
      {subtitle && <p className="text-sm text-warm-mute mt-1 max-w-sm mx-auto">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
