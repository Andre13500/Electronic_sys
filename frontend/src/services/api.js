import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? '/api'
export const UPLOADS_BASE = API_URL.replace(/\/api\/?$/, '')

const api = axios.create({
  baseURL: API_URL,
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
  // Perfil del usuario autenticado (incluye fecha de creación). No expone contraseña.
  me: () => api.get('/auth/me'),
}

export const informesApi = {
  // Módulos de servicio disponibles (tipo, label, descripción, icono, imagen, slots).
  // Se definen en el backend en Templates/config/*.json — el frontend no los hardcodea.
  modulos: () => api.get('/informes/modulos'),
  listar: (q) => api.get('/informes', { params: q ? { q } : {} }),
  obtener: (id) => api.get(`/informes/${id}`),
  // tipoServicio: uno de los tipos dinámicos devueltos por modulos() (ver Templates/config/*.json)
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
  eliminar: (id) => api.delete(`/informes/${id}`),
  descargar: async (id, formato) => {
    const url = formato === 'pdf'
      ? `/informes/${id}/exportar/pdf`
      : `/informes/${id}/exportar/excel`
    const res = await api.get(url, { responseType: 'blob' })

    // Tipo MIME correcto para que el móvil sepa qué archivo es.
    const mime = formato === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const blob = new Blob([res.data], { type: mime })

    const cd = res.headers['content-disposition'] || ''
    const m = cd.match(/filename="?([^"]+)"?/)
    const filename = m ? m[1] : (formato === 'pdf' ? 'informe.pdf' : 'informe.xlsx')

    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = filename
    a.rel = 'noopener'
    // IMPORTANTE en móviles (Android/Chrome): el enlace debe estar en el DOM
    // y NO se debe revocar la URL de inmediato, o la descarga se cancela.
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { a.remove(); URL.revokeObjectURL(objUrl) }, 1500)
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
