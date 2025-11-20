import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '7*8手串',
  description: ''
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
