import { useEffect, useState } from 'react'
import { informesApi } from './api'

// ═══════════════════════════════════════════════════════════════════════
// MÓDULOS DE SERVICIO (dinámicos)
//
// La lista de tipos de servicio, sus etiquetas y sus fotos (slots) viene del
// backend (GET /api/informes/modulos), que a su vez la deriva de los archivos
// Templates/config/*.json. Así, AGREGAR UN MÓDULO NUEVO no requiere tocar el
// frontend: basta crear el JSON de config (y opcionalmente una imagen).
//
// Este helper cachea la respuesta en memoria (una sola petición por sesión) y
// expone un hook useModulos() para consumirla desde cualquier página.
// ═══════════════════════════════════════════════════════════════════════

// Imágenes locales conocidas. La clave es el nombre de archivo referenciado en
// el campo "imagen" de la config. Los módulos sin imagen usan una tarjeta con
// degradado + el icono (emoji) definido en la config.
import washtowerImg from '../../img/washtower.jpg'
import refrigeradorImg from '../../img/refrigerador.jpg'
import lavadoraImg from '../../img/washingmach.jpg'
import secadoraImg from '../../img/dryer.jpg'
import aireAcondicionadoImg from '../../img/coldAir.jpg'
import estufa from '../../img/estufas.jpg'
import tv from '../../img/Tvlg.png'
const IMAGENES = {
  'washtower.jpg': washtowerImg,
  'refrigerador.jpg': refrigeradorImg,
  'lavadora.jpg': lavadoraImg,
  'secadora.jpg': secadoraImg,
  'aireAcondicionado.jpg': aireAcondicionadoImg,
  'estufa.jpg': estufa,
  'tv.jpg': tv,
  
}

// Devuelve la URL de imagen local para un módulo, o null si no hay imagen.
export const imagenDeModulo = (mod) => IMAGENES[mod?.imagen] ?? null

let _cache = null
let _promise = null

// Obtiene los módulos (cacheados). Reutiliza la misma promesa si hay varias
// llamadas simultáneas.
export async function cargarModulos() {
  if (_cache) return _cache
  if (!_promise) {
    _promise = informesApi.modulos()
      .then(({ data }) => { _cache = data; return data })
      .catch((e) => { _promise = null; throw e })
  }
  return _promise
}

// Hook que entrega { modulos, loading, error } y un mapa por tipo para acceso rápido.
export function useModulos() {
  const [modulos, setModulos] = useState(_cache ?? [])
  const [loading, setLoading] = useState(!_cache)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vivo = true
    if (_cache) { setModulos(_cache); setLoading(false); return }
    cargarModulos()
      .then((data) => { if (vivo) { setModulos(data); setLoading(false) } })
      .catch(() => { if (vivo) { setError('No se pudieron cargar los módulos'); setLoading(false) } })
    return () => { vivo = false }
  }, [])

  const porTipo = Object.fromEntries(modulos.map((m) => [m.tipo, m]))
  return { modulos, porTipo, loading, error }
}
