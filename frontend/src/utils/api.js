const stripTrailingSlashes = (value = '') => value.replace(/\/+$/, '')

const resolveApiBaseUrl = () => {
  const envUrl =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
    ''
  if (envUrl) {
    return stripTrailingSlashes(String(envUrl))
  }
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return stripTrailingSlashes(window.location.origin)
  }
  return ''
}

const API_BASE_URL = resolveApiBaseUrl()

export const buildApiUrl = (path = '') => {
  if (typeof path !== 'string') return ''
  if (/^https?:\/\//i.test(path)) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!API_BASE_URL) return normalizedPath
  return `${API_BASE_URL}${normalizedPath}`
}

const isSuccessStatus = (status) => status >= 200 && status < 300

const parseFetchResponse = async (response) => {
  const contentType = response.headers?.get?.('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : null
  } catch (_error) {
    return text
  }
}

export const requestJson = async (path, options = {}) => {
  const url = buildApiUrl(path)
  const method = options.method || 'GET'
  const headers = options.headers || options.header || {}
  const payload = options.body ?? options.data

  if (typeof uni !== 'undefined' && typeof uni.request === 'function') {
    const response = await new Promise((resolve, reject) => {
      uni.request({
        url,
        method,
        data: payload,
        header: headers,
        success: resolve,
        fail: reject
      })
    })
    const status = response?.statusCode
    if (!isSuccessStatus(status)) {
      throw new Error(`Request failed with status ${status}`)
    }
    return response?.data ?? null
  }

  if (typeof fetch === 'function') {
    const fetchOptions = { method, headers }
    if (payload && method.toUpperCase() !== 'GET') {
      fetchOptions.body = typeof payload === 'string' ? payload : JSON.stringify(payload)
      fetchOptions.headers = { 'Content-Type': 'application/json', ...headers }
    }

    const response = await fetch(url, fetchOptions)
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }
    return parseFetchResponse(response)
  }

  throw new Error('No available request method (fetch/uni.request)')
}

export default {
  buildApiUrl,
  requestJson
}
