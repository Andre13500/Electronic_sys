import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../services/api'

const Ctx = createContext(null)

// Decodifica el payload de un JWT (sin validar la firma — eso lo hace el backend).
// Solo se usa para leer la expiración y evitar mostrar una sesión ya vencida.
function decodeJwt(token) {
  try {
    let b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    while (b.length % 4) b += '='
    return JSON.parse(atob(b))
  } catch { return null }
}

// true si el token no existe, está mal formado o ya expiró (con la hora del cliente).
export function tokenVencido(token) {
  if (!token) return true
  const p = decodeJwt(token)
  if (!p || !p.exp) return true
  return Date.now() >= p.exp * 1000
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')

    // 1) Sin token o token expirado → sesión no válida: limpiar y exigir login.
    //    Esto evita el "parpadeo" de mostrar la app y luego rebotar al login.
    if (tokenVencido(token)) {
      localStorage.clear()
      setLoading(false)
      return
    }

    // 2) Token aún vigente localmente → mostramos la sesión.
    const s = localStorage.getItem('user')
    if (s) { try { setUser(JSON.parse(s)) } catch {} }
    setMustChangePassword(localStorage.getItem('mustChangePassword') === 'true')
    setLoading(false)

    // 3) Revalidación en segundo plano contra el backend. Si el token fue revocado
    //    o el usuario fue desactivado/eliminado, /auth/me responde 401 y el
    //    interceptor de axios limpia la sesión y redirige al login.
    authApi.me().catch(() => {})
  }, [])

  const login = async (email, password) => {
    const { data } = await authApi.login(email, password)
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.usuario))
    localStorage.setItem('mustChangePassword', data.mustChangePassword ? 'true' : 'false')
    setUser(data.usuario)
    setMustChangePassword(data.mustChangePassword)
    return data
  }

  // Llamado después de cambiar la contraseña exitosamente
  const onPasswordChanged = (newToken) => {
    localStorage.setItem('token', newToken)
    localStorage.setItem('mustChangePassword', 'false')
    setMustChangePassword(false)
  }

  const logout = () => {
    localStorage.clear()
    setUser(null)
    setMustChangePassword(false)
  }

  return (
    <Ctx.Provider value={{ user, mustChangePassword, onPasswordChanged, login, logout, loading }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fuera de AuthProvider')
  return v
}
