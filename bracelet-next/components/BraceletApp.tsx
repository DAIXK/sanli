'use client'

import { useMemo } from 'react'
import styles from './BraceletApp.module.css'

const H5_ENTRY_PATH = '/h5/index.html'

export default function BraceletApp() {
  const iframeSrc = useMemo(() => H5_ENTRY_PATH, [])

  return (
    <main className={styles.host}>
      <div className={styles.wrapper}>
        <iframe
          title="三粒手串定制 H5"
          src={iframeSrc}
          className={styles.shell}
          allow="fullscreen; xr-spatial-tracking"
        />
        <noscript>
          <div className={styles.fallback}>需要开启 JavaScript 才能加载 3D 预览</div>
        </noscript>
      </div>
    </main>
  )
}
