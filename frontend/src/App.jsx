import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.jsx'
import Login from './pages/Login.jsx'
import Shell from './components/Shell.jsx'
import InformesList from './pages/InformesList.jsx'
import InformeEditor from './pages/InformeEditor.jsx'
import InformePreview from './pages/InformePreview.jsx'
import ModuleSelector from './pages/ModuleSelector.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import ChangePassword from './pages/ChangePassword.jsx'

// Ruta protegida: requiere login. Si MustChangePassword, redirige a cambiar contraseña.
function Protected({ children }) {
  const { user, mustChangePassword, loading } = useAuth()
  if (loading) return <div className="p-8 text-warm-mute">Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  if (mustChangePassword) return <Navigate to="/change-password" replace />
  return children
}

// Ruta solo para Admin
function AdminOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user || user.rol !== 'Admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Cambio de contraseña obligatorio (no requiere Shell) */}
      <Route path="/change-password" element={<ChangePassword />} />

      <Route path="/" element={<Protected><Shell /></Protected>}>
        <Route index element={<InformesList />} />

        {/* Selector de módulo (WashTower, Refrigeradora, etc.) */}
        {/* Para agregar nuevos módulos: ver ModuleSelector.jsx > MODULES */}
        <Route path="nuevo-informe" element={<ModuleSelector />} />

        {/* Editor e informe */}
        <Route path="informes/:id" element={<InformeEditor />} />
        <Route path="informes/:id/preview" element={<InformePreview />} />

        {/* Panel de administración — solo Admin */}
        <Route path="admin" element={<AdminOnly><AdminPanel /></AdminOnly>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
