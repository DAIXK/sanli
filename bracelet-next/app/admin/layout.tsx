import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '管理后台 - 两岸手串',
  description: '用于维护手串素材、金价和加工费的管理后台'
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-layout">{children}</div>
}
