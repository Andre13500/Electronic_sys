import { useEffect, useState } from 'react'
import api from '../services/api'

// Muestra una imagen servida por un endpoint AUTENTICADO del backend.
// Descarga el archivo con el token (vía axios) y lo convierte en un blob local,
// porque un <img src> normal no envía la cabecera Authorization.
//
// props:
//   path      -> ruta de la API relativa (ej: "/informes/5/fotos/3/imagen")
//   alt, className, style -> se pasan a la imagen / placeholder
export default function AuthImage({ path, alt = '', className = '', style }) {
  const [src, setSrc] = useState(null)

  useEffect(() => {
    if (!path) { setSrc(null); return }
    let objUrl = null
    let vivo = true
    api.get(path, { responseType: 'blob' })
      .then(res => {
        if (!vivo) return
        objUrl = URL.createObjectURL(res.data)
        setSrc(objUrl)
      })
      .catch(() => { if (vivo) setSrc(null) })
    return () => {
      vivo = false
      if (objUrl) URL.revokeObjectURL(objUrl)
    }
  }, [path])

  // Placeholder mientras carga (mantiene el tamaño del contenedor)
  if (!src) return <div className={`bg-warm-bg animate-pulse ${className}`} style={style} />

  return <img src={src} alt={alt} className={className} style={style} />
}
