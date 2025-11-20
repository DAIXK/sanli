import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '定制手串 (Next)',
  description: '基于 Next.js 的三维手串定制 H5'
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
