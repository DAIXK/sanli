import AdminDashboard from '@/components/admin/AdminDashboard'
import { requireAdminSession } from '@/lib/auth'
import { fetchBracelets, fetchGlobalSettings, fetchMaterials } from '@/lib/dashboard'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  requireAdminSession()
  const [materials, settings, bracelets] = await Promise.all([
    fetchMaterials(),
    fetchGlobalSettings(),
    fetchBracelets()
  ])

  return (
    <AdminDashboard
      initialMaterials={materials}
      initialSettings={settings}
      initialBracelets={bracelets}
    />
  )
}
