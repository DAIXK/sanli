import { requestJson } from './api'

const ensureArray = (value) => (Array.isArray(value) ? value : [])
const toNumberOrNull = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const normalizeTabMeta = (item = {}) => {
  const maxBeads = toNumberOrNull(item.maxBeads)
  return {
    id: item.id || item._id || '',
    name: item.name || '',
    model: item.model || '',
    maxBeads,
    isVisible: item.isVisible !== false
  }
}

const normalizeBackgrounds = (detail = {}, tabMeta = {}) => {
  const fallbackMax =
    toNumberOrNull(detail.maxBeads) ?? toNumberOrNull(tabMeta.maxBeads) ?? undefined
  const backgrounds = ensureArray(detail.background)
    .map((item) => {
      const max = toNumberOrNull(item?.max) ?? fallbackMax
      const glb = item?.glb || tabMeta.model || ''
      if (!glb) return null
      return {
        ...item,
        glb,
        name: item?.name || detail.name || tabMeta.name || '',
        max
      }
    })
    .filter(Boolean)

  if (!backgrounds.length && tabMeta.model) {
    backgrounds.push({
      glb: tabMeta.model,
      name: detail.name || tabMeta.name || '',
      max: fallbackMax
    })
  }

  return backgrounds
}

const normalizeProducts = (detail = {}) =>
  ensureArray(detail.product).map((item) => ({
    ...item,
    glb: item?.glb || '',
    png: item?.png || '',
    rotationAxis: item?.rotationAxis || item?.rotation_axis || item?.rotationaxis || 'radial'
  }))

export const fetchBraceletTabs = async () => {
  const data = await requestJson('/api/mobile/tabs')
  if (!Array.isArray(data)) return []
  return data.map(normalizeTabMeta).filter((item) => item.id && item.isVisible)
}

export const fetchBraceletTabDetail = async (tabId) => {
  if (!tabId) return null
  const data = await requestJson(`/api/mobile/tabs/${tabId}`)
  if (!data || typeof data !== 'object') return null
  return data
}

const buildMaterialEntry = (tabMeta, detail) => {
  if (!detail || !tabMeta) return null
  return {
    price: detail.price ?? tabMeta.price ?? '-',
    name: detail.name || tabMeta.name || '',
    background: normalizeBackgrounds(detail, tabMeta),
    product: normalizeProducts(detail)
  }
}

export const loadBraceletMaterials = async () => {
  try {
    const tabs = await fetchBraceletTabs()
    if (!tabs.length) return {}

    const entries = await Promise.all(
      tabs.map(async (tab) => {
        try {
          const detail = await fetchBraceletTabDetail(tab.id)
          return { tab, detail }
        } catch (error) {
          console.warn(`加载手串 ${tab.id} 失败`, error)
          return null
        }
      })
    )

    return entries.reduce((acc, entry) => {
      if (!entry?.detail || !entry.tab?.id) return acc
      const normalized = buildMaterialEntry(entry.tab, entry.detail)
      if (normalized) {
        acc[entry.tab.id] = normalized
      }
      return acc
    }, {})
  } catch (error) {
    console.error('加载手串配置失败', error)
    return {}
  }
}

export default {
  fetchBraceletTabs,
  fetchBraceletTabDetail,
  loadBraceletMaterials
}
