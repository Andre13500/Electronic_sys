import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 30000,
})

api.interceptors.request.use(c => {
  const t = localStorage.getItem('token')
  if (t) c.headers.Authorization = `Bearer ${t}`
  return c
})

api.interceptors.response.use(r => r, e => {
  if (e.response?.status === 401) {
    localStorage.clear()
    if (!location.pathname.startsWith('/login')) location.href = '/login'
  }
  return Promise.reject(e)
})

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  changePassword: (passwordActual, passwordNuevo) =>
    api.post('/auth/change-password', { passwordActual, passwordNuevo }),
}

export const informesApi = {
  listar: (q) => api.get('/informes', { params: q ? { q } : {} }),
  obtener: (id) => api.get(`/informes/${id}`),
  // tipoServicio: "washtower" | "refrigerador"
  // Para agregar un nuevo tipo ver: Models.cs > TipoServicio y ModuleSelector.jsx > MODULES
  crear: (tipoServicio) => api.post('/informes', { tipoServicio }),
  guardar: (id, data) => api.put(`/informes/${id}`, data),
  subirFoto: (id, slot, file) => {
    const fd = new FormData()
    fd.append('slot', slot)
    fd.append('archivo', file)
    return api.post(`/informes/${id}/fotos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  eliminarFoto: (id, fotoId) => api.delete(`/informes/${id}/fotos/${fotoId}`),
  finalizar: (id) => api.post(`/informes/${id}/finalizar`),
  descargar: async (id, formato) => {
    const url = formato === 'pdf'
      ? `/informes/${id}/exportar/pdf`
      : `/informes/${id}/exportar/excel`
    const res = await api.get(url, { responseType: 'blob' })
    const blob = new Blob([res.data])
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const cd = res.headers['content-disposition'] || ''
    const m = cd.match(/filename="?([^"]+)"?/)
    a.download = m ? m[1] : (formato === 'pdf' ? 'informe.pdf' : 'informe.xlsx')
    a.click()
    URL.revokeObjectURL(a.href)
  },
}

// API de administración (solo para rol Admin)
export const adminApi = {
  listarUsuarios: () => api.get('/admin/usuarios'),
  crearUsuario: (nombre, email, rol) => api.post('/admin/usuarios', { nombre, email, rol }),
  resetPassword: (id) => api.put(`/admin/usuarios/${id}/reset-password`),
  toggleActivo: (id, activo) => api.put(`/admin/usuarios/${id}/toggle-activo`, activo, {
    headers: { 'Content-Type': 'application/json' }
  }),
}

export default api
