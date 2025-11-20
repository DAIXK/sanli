'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from './BraceletApp.module.css'

const H5_ENTRY_PATH = '/h5/index.html'
const DEFAULT_TITLE = '定制手串 (Next)'

const parseMessage = (event: MessageEvent) => {
  const raw = event?.data
  if (!raw) return null
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch (error) {
      return null
    }
  }
  return null
}

export default function BraceletApp() {
  const iframeSrc = useMemo(() => H5_ENTRY_PATH, [])
  const [pageTitle, setPageTitle] = useState<string>(DEFAULT_TITLE)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = pageTitle || DEFAULT_TITLE
    }
  }, [pageTitle])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const payload = parseMessage(event)
      if (
        payload &&
        typeof payload === 'object' &&
        payload.type === 'bracelet:title' &&
        typeof payload.title === 'string'
      ) {
        setPageTitle(payload.title || DEFAULT_TITLE)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

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
