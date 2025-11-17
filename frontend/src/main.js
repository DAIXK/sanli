import { createSSRApp } from 'vue'
import App from './App.vue'

export function createApp() {
  const app = createSSRApp(App)

  if (typeof document !== 'undefined') {
    const existing = document.querySelector('meta[name="viewport"]')
    const viewportContent =
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    if (existing) {
      existing.setAttribute('content', viewportContent)
    } else {
      const meta = document.createElement('meta')
      meta.setAttribute('name', 'viewport')
      meta.setAttribute('content', viewportContent)
      document.head.appendChild(meta)
    }
  }

  return {
    app
  }
}
