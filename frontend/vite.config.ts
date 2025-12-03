import { defineConfig, loadEnv } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const uni = typeof uniPlugin === 'function' ? uniPlugin : (uniPlugin as any).default

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = env.VITE_API_BASE_URL || 'http://localhost:3000'

  return {
    plugins: [
      uni(),
      viteStaticCopy({
        targets: [
          {
            src: 'static/**/*',
            dest: 'static'
          },
          {
            src: 'static/models/kNNXOz2HCs.txt',
            dest: '.',
            rename: 'kNNXOz2HCs.txt'
          }
        ]
      })
    ],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: apiBase,
          changeOrigin: true,
          secure: false
        }
      }
    }
  }
})
