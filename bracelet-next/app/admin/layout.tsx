import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '管理后台 ',
  description: ''
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-layout">{children}</div>
}
