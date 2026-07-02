import { useEffect, useState } from 'react'
import { adminApi } from '../services/api'
import { useToast } from '../components/Toast.jsx'
import { Avatar } from '../components/ui.jsx'

const fmtFecha = (d) => new Date(d).toLocaleDateString('es-EC', {
  day: '2-digit', month: 'short', year: 'numeric'
})

const ROL_LABEL = { Admin: 'Administrador', Tecnico: 'Técnico' }

export default function AdminPanel() {
  const toast = useToast()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCrear, setShowCrear] = useState(false)
  const [verPerfil, setVerPerfil] = useState(null) // usuario a visualizar (solo lectura)
  const [resultado, setResultado] = useState(null) // { tipo: 'crear' | 'reset', datos }
  const [error, setError] = useState(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await adminApi.listarUsuarios()
      setUsuarios(data)
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const resetPassword = async (usuario) => {
    if (!confirm(`¿Restablecer la contraseña de ${usuario.nombre}?\nEl usuario deberá cambiarla en su próximo inicio de sesión.`))
      return
    setError(null)
    try {
      const { data } = await adminApi.resetPassword(usuario.id)
      setResultado({ tipo: 'reset', nombre: usuario.nombre, password: data.passwordTemporal })
      await cargar()
      toast.success(`Contraseña restablecida para ${usuario.nombre}.`)
    } catch (e) {
      const msg = e.response?.data?.error ?? 'Error al restablecer contraseña'
      setError(msg); toast.error(msg)
    }
  }

  const toggleActivo = async (usuario) => {
    const accion = usuario.activo ? 'desactivar' : 'activar'
    if (!confirm(`¿Deseas ${accion} a ${usuario.nombre}?`)) return
    setError(null)
    try {
      await adminApi.toggleActivo(usuario.id, !usuario.activo)
      await cargar()
      toast.success(`Usuario ${usuario.activo ? 'desactivado' : 'activado'}.`)
    } catch (e) {
      const msg = e.response?.data?.error ?? 'Error al actualizar usuario'
      setError(msg); toast.error(msg)
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-warm-ink tracking-tight">Gestión de Usuarios</h2>
          <p className="text-sm text-warm-mute mt-0.5">Crea y administra las cuentas de los técnicos.</p>
        </div>
        <button onClick={() => { setShowCrear(true); setResultado(null); setError(null) }} className="btn-primary">
          + Nuevo usuario
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {/* Resultado de última acción */}
      {resultado && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          {resultado.tipo === 'crear' ? (
            <>
              <p className="font-medium text-emerald-800 mb-1">Usuario creado exitosamente</p>
              <p className="text-sm text-emerald-700">Nombre: <strong>{resultado.nombre}</strong></p>
              <p className="text-sm text-emerald-700">Email: <strong>{resultado.email}</strong></p>
            </>
          ) : (
            <p className="font-medium text-emerald-800 mb-1">Contraseña restablecida para <strong>{resultado.nombre}</strong></p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-emerald-700">Contraseña temporal:</span>
            <code className="bg-white border border-emerald-300 px-3 py-1 rounded-lg text-sm font-bold text-emerald-800 tracking-wider">
              {resultado.password}
            </code>
          </div>
          <p className="text-xs text-emerald-600 mt-1">Comparte esta contraseña con el usuario. Deberá cambiarla al iniciar sesión.</p>
          <button onClick={() => setResultado(null)} className="mt-2 text-xs text-emerald-600 underline">Cerrar</button>
        </div>
      )}

      {/* Modal de crear usuario */}
      {showCrear && (
        <CrearUsuarioModal
          onClose={() => setShowCrear(false)}
          onCreado={(datos) => {
            setResultado({ tipo: 'crear', ...datos })
            setShowCrear(false)
            cargar()
            toast.success(`Usuario ${datos.nombre} creado.`)
          }}
        />
      )}

      {/* Modal de ver perfil (solo lectura). El Admin nunca ve contraseñas. */}
      {verPerfil && (
        <VerPerfilModal usuario={verPerfil} onClose={() => setVerPerfil(null)} />
      )}

      {/* Tabla de usuarios */}
      {loading ? (
        <div className="text-warm-mute text-sm py-12 text-center">Cargando usuarios...</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-line bg-warm-bg">
                  <th className="text-left px-4 py-3 text-xs font-medium text-warm-mute uppercase tracking-wide">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-warm-mute uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-warm-mute uppercase tracking-wide">Rol</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-warm-mute uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-warm-mute uppercase tracking-wide">Creado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-line">
                {usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-warm-bg/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar nombre={u.nombre} size="sm" />
                        <div>
                          <div className="font-medium text-warm-ink">{u.nombre}</div>
                          {u.mustChangePassword && (
                            <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
                              Debe cambiar contraseña
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-warm-mute">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        u.rol === 'Admin'
                          ? 'bg-brand-50 text-brand-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        u.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-warm-mute text-xs">{fmtFecha(u.creadoEn)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setVerPerfil(u)}
                          className="text-xs text-warm-mute hover:text-brand-600 transition-colors"
                          title="Ver perfil"
                        >
                          👁 Ver
                        </button>
                        <button
                          onClick={() => resetPassword(u)}
                          className="text-xs text-warm-mute hover:text-brand-600 transition-colors"
                          title="Restablecer contraseña"
                        >
                          🔑 Reset
                        </button>
                        <button
                          onClick={() => toggleActivo(u)}
                          className={`text-xs transition-colors ${
                            u.activo
                              ? 'text-warm-mute hover:text-red-600'
                              : 'text-warm-mute hover:text-emerald-600'
                          }`}
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function CrearUsuarioModal({ onClose, onCreado }) {
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'Tecnico' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await adminApi.crearUsuario(form.nombre, form.email, form.rol)
      onCreado({
        nombre: data.usuario.nombre,
        email: data.usuario.email,
        password: data.passwordTemporal,
      })
    } catch (e) {
      setError(e.response?.data?.error ?? 'Error al crear usuario')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="card-glass shadow-lift w-full max-w-md p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-warm-ink">Crear nuevo usuario</h3>
          <button onClick={onClose} className="text-warm-mute hover:text-warm-ink text-xl leading-none">&times;</button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Nombre completo</label>
            <input className="input" value={form.nombre} onChange={e => upd('nombre', e.target.value)}
              placeholder="Ej: Juan Pérez" required />
          </div>
          <div>
            <label className="label">Correo electrónico</label>
            <input className="input" type="email" value={form.email} onChange={e => upd('email', e.target.value)}
              placeholder="usuario@empresa.com" required />
          </div>
          <div>
            <label className="label">Rol</label>
            <select className="input" value={form.rol} onChange={e => upd('rol', e.target.value)}>
              <option value="Tecnico">Técnico</option>
              <option value="Admin">Administrador</option>
            </select>
          </div>
          <p className="text-xs text-warm-mute">
            Se generará una contraseña temporal. El usuario deberá cambiarla al iniciar sesión.
          </p>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Vista de solo lectura del perfil de otro usuario.
// El Admin SOLO puede ver: nombre, usuario, correo y rol. Nunca la contraseña.
function VerPerfilModal({ usuario, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="card-glass shadow-lift w-full max-w-sm p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-warm-ink">Perfil del usuario</h3>
          <button onClick={onClose} className="text-warm-mute hover:text-warm-ink text-xl leading-none">&times;</button>
        </div>
        <div className="flex flex-col items-center text-center mb-5">
          <Avatar nombre={usuario.nombre} size="lg" className="mb-3" />
          <div className="font-semibold text-warm-ink">{usuario.nombre}</div>
          <span className={`badge mt-2 ${usuario.rol === 'Admin'
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/20 dark:text-brand-200'
            : 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'}`}>
            {ROL_LABEL[usuario.rol] ?? usuario.rol}
          </span>
        </div>
        <dl className="space-y-3 text-sm">
          <ReadRow label="Usuario" value={usuario.email} />
          <ReadRow label="Correo electrónico" value={usuario.email} />
          <ReadRow label="Rol" value={ROL_LABEL[usuario.rol] ?? usuario.rol} />
          <ReadRow label="Estado" value={usuario.activo ? 'Activo' : 'Inactivo'} />
          <ReadRow label="Creado" value={fmtFecha(usuario.creadoEn)} />
        </dl>
        <p className="text-[11px] text-warm-mute mt-5 flex items-center gap-1.5">
          <span>🔒</span> Por seguridad, las contraseñas nunca son visibles.
        </p>
      </div>
    </div>
  )
}

function ReadRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-warm-line pb-2 last:border-0">
      <dt className="text-warm-mute">{label}</dt>
      <dd className="text-warm-ink font-medium text-right break-all">{value}</dd>
    </div>
  )
}
