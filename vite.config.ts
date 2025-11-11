import { defineConfig } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'

const uni = typeof uniPlugin === 'function' ? uniPlugin : (uniPlugin as any).default

export default defineConfig({
  plugins: [uni()]
})
