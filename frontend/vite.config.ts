import { defineConfig } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const uni = typeof uniPlugin === 'function' ? uniPlugin : (uniPlugin as any).default

export default defineConfig({
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
    host: '0.0.0.0'
  }
})
