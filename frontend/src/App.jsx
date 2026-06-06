import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.jsx'

const Login          = lazy(() => import('./pages/Login.jsx'))
const Shell          = lazy(() => import('./components/Shell.jsx'))
const InformesList   = lazy(() => import('./pages/InformesList.jsx'))
const InformeEditor  = lazy(() => import('./pages/InformeEditor.jsx'))
const InformePreview = lazy(() => import('./pages/InformePreview.jsx'))
const ModuleSelector = lazy(() => import('./pages/ModuleSelector.jsx'))
const AdminPanel     = lazy(() => import('./pages/AdminPanel.jsx'))
const ChangePassword = lazy(() => import('./pages/ChangePassword.jsx'))

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-[#a50034] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function Protected({ children }) {
  const { user, mustChangePassword, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (mustChangePassword) return <Navigate to="/change-password" replace />
  return children
}

function AdminOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user || user.rol !== 'Admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />

        <Route path="/" element={<Protected><Shell /></Protected>}>
          <Route index element={<InformesList />} />
          <Route path="nuevo-informe" element={<ModuleSelector />} />
          <Route path="informes/:id" element={<InformeEditor />} />
          <Route path="informes/:id/preview" element={<InformePreview />} />
          <Route path="admin" element={<AdminOnly><AdminPanel /></AdminOnly>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
