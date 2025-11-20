'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.message || '登录失败')
      }
      router.replace('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="admin-card"
      style={{ width: 'min(480px, 90vw)', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>手串管理后台</h1>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>邮箱</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid #d1d5db' }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>密码</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid #d1d5db' }}
        />
      </label>
      {error && (
        <div style={{ color: '#dc2626', fontSize: 14 }}>
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '12px 16px',
          background: '#111827',
          borderRadius: 8,
          color: '#fff',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? '登录中...' : '登录'}
      </button>
    </form>
  )
}
