import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../services/api'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const s = localStorage.getItem('user')
    const mcp = localStorage.getItem('mustChangePassword') === 'true'
    if (s) { try { setUser(JSON.parse(s)) } catch {} }
    setMustChangePassword(mcp)
    setLoading(false)
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
