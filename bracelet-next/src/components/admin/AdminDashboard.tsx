"use client"

import { useCallback, useState } from 'react'
import useSWR from 'swr'
import type {
  BraceletRecord,
  GlobalSettings,
  MaterialRecord,
  RotationAxis
} from '@/types/material'

const fetcher = (url: string) =>
  fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error('请求失败')
    }
    return response.json()
  })

interface Props {
  initialMaterials: MaterialRecord[]
  initialSettings: GlobalSettings | null
  initialBracelets: BraceletRecord[]
}

const rotationAxisOptions: RotationAxis[] = ['radial', 'tangent', 'normal']

export default function AdminDashboard({
  initialMaterials,
  initialSettings,
  initialBracelets
}: Props) {
  const {
    data: settings,
    mutate: mutateSettings,
    isValidating: settingsSaving
  } = useSWR<GlobalSettings | null>('/api/admin/settings', fetcher, {
    fallbackData: initialSettings
  })
  const {
    data: materials,
    mutate: mutateMaterials,
    isValidating: materialsLoading
  } = useSWR<MaterialRecord[]>('/api/admin/materials', fetcher, {
    fallbackData: initialMaterials
  })
  const {
    data: bracelets,
    mutate: mutateBracelets,
    isValidating: braceletsLoading
  } = useSWR<BraceletRecord[]>('/api/admin/bracelets', fetcher, {
    fallbackData: initialBracelets
  })

  const handleSettingsSubmit = async (payload: Partial<GlobalSettings>) => {
    const response = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.message || '保存失败')
    }
    const data = await response.json()
    mutateSettings(data, false)
  }

  const handleMaterialSave = useCallback(
    async (id: string, payload: Partial<MaterialRecord>) => {
      const response = await fetch(`/api/admin/materials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || '更新失败')
      }
      const updated = await response.json()
      mutateMaterials(
        (prev = []) => prev.map((item) => (item.id === id ? updated : item)),
        false
      )
    },
    [mutateMaterials]
  )

  const handleMaterialCreate = async (payload: Partial<MaterialRecord>) => {
    const response = await fetch('/api/admin/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.message || '创建失败')
    }
    const created = await response.json()
    mutateMaterials((prev = []) => [created, ...(prev ?? [])], false)
  }

  const handleBraceletUpdate = async (id: string, payload: Partial<BraceletRecord>) => {
    const response = await fetch(`/api/admin/bracelets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.message || '更新失败')
    }
    const updated = await response.json()
    mutateBracelets(
      (prev = []) => prev.map((item) => (item.id === id ? updated : item)),
      false
    )
  }

  const handleBraceletCreate = async (payload: Partial<BraceletRecord>) => {
    const response = await fetch('/api/admin/bracelets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.message || '创建失败')
    }
    const created = await response.json()
    mutateBracelets((prev = []) => [...(prev ?? []), created], false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>管理后台</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280' }}>配置素材、金价、加工费与手串限制</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await fetch('/api/admin/logout', { method: 'POST' })
            window.location.href = '/admin/login'
          }}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: '1px solid rgba(15,23,42,0.1)',
            background: '#fff',
            cursor: 'pointer'
          }}
        >
          退出
        </button>
      </header>

      <section className="admin-card">
        <GlobalSettingsForm
          initialValues={settings ?? null}
          isSaving={settingsSaving}
          onSubmit={handleSettingsSubmit}
        />
      </section>

      {/* 其它功能暂时隐藏 */}
    </div>
  )
}

const SettingsInput = ({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
    <span style={{ fontSize: 14, color: '#4b5563' }}>{label}</span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px solid #d1d5db'
      }}
    />
  </label>
)

function GlobalSettingsForm({
  initialValues,
  onSubmit,
  isSaving
}: {
  initialValues: GlobalSettings | null
  onSubmit: (payload: Partial<GlobalSettings>) => Promise<void>
  isSaving: boolean
}) {
  const [goldPrice, setGoldPrice] = useState(
    () => initialValues?.gold_price_per_gram?.toString() ?? ''
  )
  const [processingFee, setProcessingFee] = useState(
    () => initialValues?.processing_fee?.toString() ?? ''
  )
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage(null)
    try {
      await onSubmit({
        gold_price_per_gram: Number(goldPrice || 0),
        processing_fee: Number(processingFee || 0)
      })
      setMessage('已保存')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败')
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>全局设置</h2>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <SettingsInput
          label="金价 (元/克)"
          value={goldPrice}
          onChange={(value) => setGoldPrice(value)}
        />
        <SettingsInput
          label="加工费 (元)"
          value={processingFee}
          onChange={(value) => setProcessingFee(value)}
        />
      </div>
      {message && (
        <p style={{ margin: 0, color: message === '已保存' ? '#16a34a' : '#dc2626' }}>{message}</p>
      )}
      <div>
        <button
          type="submit"
          disabled={isSaving}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: '#111827',
            color: '#fff',
            cursor: isSaving ? 'not-allowed' : 'pointer'
          }}
        >
          {isSaving ? '保存中...' : '保存设置'}
        </button>
      </div>
    </form>
  )
}

function BraceletManager({
  bracelets,
  loading,
  onUpdate,
  onCreate
}: {
  bracelets: BraceletRecord[]
  loading: boolean
  onUpdate: (id: string, payload: Partial<BraceletRecord>) => Promise<void>
  onCreate: (payload: Partial<BraceletRecord>) => Promise<void>
}) {
  const [form, setForm] = useState({
    name: '',
    max_beads: '',
    base_model: '',
    description: ''
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreating(true)
    setError(null)
    try {
      await onCreate({
        name: form.name,
        max_beads: Number(form.max_beads),
        base_model: form.base_model || undefined,
        description: form.description || undefined
      })
      setForm({ name: '', max_beads: '', base_model: '', description: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>手串款式</h2>
        {loading && <span style={{ color: '#6b7280', fontSize: 14 }}>刷新中...</span>}
      </div>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}
      >
        <input
          placeholder="名称"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          required
          style={inputStyle}
        />
        <input
          placeholder="最大可添加粒数"
          value={form.max_beads}
          onChange={(event) => setForm({ ...form, max_beads: event.target.value })}
          required
          style={inputStyle}
        />
        <input
          placeholder="背景模型地址 (可选)"
          value={form.base_model}
          onChange={(event) => setForm({ ...form, base_model: event.target.value })}
          style={inputStyle}
        />
        <input
          placeholder="说明 (可选)"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="submit"
            disabled={creating}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#111827',
              color: '#fff',
              cursor: creating ? 'not-allowed' : 'pointer'
            }}
          >
            {creating ? '创建中...' : '新增手串'}
          </button>
          {error && <span style={{ color: '#dc2626' }}>{error}</span>}
        </div>
      </form>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#6b7280' }}>
              <th style={thStyle}>名称</th>
              <th style={thStyle}>最大粒数</th>
              <th style={thStyle}>背景模型</th>
              <th style={thStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {bracelets.map((bracelet) => (
              <BraceletRow key={bracelet.id} bracelet={bracelet} onUpdate={onUpdate} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BraceletRow({
  bracelet,
  onUpdate
}: {
  bracelet: BraceletRecord
  onUpdate: (id: string, payload: Partial<BraceletRecord>) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState({
    name: bracelet.name,
    max_beads: bracelet.max_beads.toString(),
    base_model: bracelet.base_model || '',
    description: bracelet.description || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onUpdate(bracelet.id, {
        ...local,
        max_beads: Number(local.max_beads || 0),
        base_model: local.base_model || null,
        description: local.description || null
      })
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr>
      <td style={tdStyle}>
        {editing ? (
          <input
            value={local.name}
            onChange={(event) => setLocal({ ...local, name: event.target.value })}
            style={inputStyle}
          />
        ) : (
          <strong>{bracelet.name}</strong>
        )}
        {error && <p style={{ color: '#dc2626', fontSize: 12 }}>{error}</p>}
      </td>
      <td style={tdStyle}>
        {editing ? (
          <input
            value={local.max_beads}
            onChange={(event) => setLocal({ ...local, max_beads: event.target.value })}
            style={inputStyle}
          />
        ) : (
          bracelet.max_beads
        )}
      </td>
      <td style={tdStyle}>
        {editing ? (
          <input
            value={local.base_model}
            onChange={(event) => setLocal({ ...local, base_model: event.target.value })}
            style={inputStyle}
          />
        ) : (
          bracelet.base_model || '-'
        )}
      </td>
      <td style={tdStyle}>
        {editing ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                background: '#111827',
                color: '#fff'
              }}
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#fff'
              }}
            >
              取消
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff'
            }}
          >
            编辑
          </button>
        )}
      </td>
    </tr>
  )
}

function MaterialCreator({
  onCreate
}: {
  onCreate: (payload: Partial<MaterialRecord>) => Promise<void>
}) {
  const [form, setForm] = useState({
    name: '',
    category: 'tongzhu',
    price: '',
    weight: '',
    max_quantity: '',
    model_url: '',
    thumbnail_url: '',
    rotation_axis: 'radial' as RotationAxis,
    rotation: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    try {
      await onCreate({
        ...form,
        price: Number(form.price),
        weight: Number(form.weight),
        max_quantity: form.max_quantity ? Number(form.max_quantity) : undefined,
        rotation: form.rotation ? Number(form.rotation) : undefined
      })
      setMessage('已新增')
      setForm({
        name: '',
        category: 'tongzhu',
        price: '',
        weight: '',
        max_quantity: '',
        model_url: '',
        thumbnail_url: '',
        rotation_axis: 'radial',
        rotation: ''
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>新增珠子</h2>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
        <input
          placeholder="名称"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          required
          style={inputStyle}
        />
        <select
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
          style={inputStyle}
        >
          <option value="tongzhu">通珠</option>
          <option value="yaopian">药片</option>
        </select>
        <input
          placeholder="价格"
          value={form.price}
          onChange={(event) => setForm({ ...form, price: event.target.value })}
          required
          style={inputStyle}
        />
        <input
          placeholder="重量 (克)"
          value={form.weight}
          onChange={(event) => setForm({ ...form, weight: event.target.value })}
          required
          style={inputStyle}
        />
        <input
          placeholder="最大数量 (可选)"
          value={form.max_quantity}
          onChange={(event) => setForm({ ...form, max_quantity: event.target.value })}
          style={inputStyle}
        />
        <input
          placeholder="模型地址"
          value={form.model_url}
          onChange={(event) => setForm({ ...form, model_url: event.target.value })}
          required
          style={inputStyle}
        />
        <input
          placeholder="缩略图地址"
          value={form.thumbnail_url}
          onChange={(event) => setForm({ ...form, thumbnail_url: event.target.value })}
          style={inputStyle}
        />
        <select
          value={form.rotation_axis}
          onChange={(event) =>
            setForm({ ...form, rotation_axis: event.target.value as RotationAxis })
          }
          style={inputStyle}
        >
          {rotationAxisOptions.map((axis) => (
            <option key={axis} value={axis}>
              {axis}
            </option>
          ))}
        </select>
        <input
          placeholder="旋转 (弧度，可选)"
          value={form.rotation}
          onChange={(event) => setForm({ ...form, rotation: event.target.value })}
          style={inputStyle}
        />
      </div>
      {message && (
        <p style={{ color: message === '已新增' ? '#16a34a' : '#dc2626', margin: 0 }}>{message}</p>
      )}
      <div>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: '#111827',
            color: '#fff',
            cursor: submitting ? 'not-allowed' : 'pointer'
          }}
        >
          {submitting ? '提交中...' : '创建珠子'}
        </button>
      </div>
    </form>
  )
}

function MaterialTable({
  materials,
  loading,
  onUpdate
}: {
  materials: MaterialRecord[]
  loading: boolean
  onUpdate: (id: string, payload: Partial<MaterialRecord>) => Promise<void>
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>珠子列表</h2>
        {loading && <span style={{ color: '#6b7280', fontSize: 14 }}>刷新中...</span>}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#6b7280' }}>
              <th style={thStyle}>名称</th>
              <th style={thStyle}>分类</th>
              <th style={thStyle}>价格</th>
              <th style={thStyle}>重量</th>
              <th style={thStyle}>最大数量</th>
              <th style={thStyle}>状态</th>
              <th style={thStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((material) => (
              <MaterialRow key={material.id} material={material} onUpdate={onUpdate} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MaterialRow({
  material,
  onUpdate
}: {
  material: MaterialRecord
  onUpdate: (id: string, payload: Partial<MaterialRecord>) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState({
    name: material.name,
    category: material.category,
    price: material.price.toString(),
    weight: material.weight.toString(),
    max_quantity: material.max_quantity?.toString() ?? '',
    model_url: material.model_url || '',
    thumbnail_url: material.thumbnail_url || '',
    rotation: material.rotation?.toString() ?? '',
    rotation_axis: (material.rotation_axis as RotationAxis) || 'radial'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onUpdate(material.id, {
        ...local,
        price: Number(local.price),
        weight: Number(local.weight),
        max_quantity: local.max_quantity ? Number(local.max_quantity) : undefined,
        rotation: local.rotation ? Number(local.rotation) : undefined
      })
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (published: boolean) => {
    setSaving(true)
    setError(null)
    try {
      await onUpdate(material.id, { published })
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr>
      <td style={tdStyle}>
        {editing ? (
          <input
            value={local.name}
            onChange={(event) => setLocal({ ...local, name: event.target.value })}
            style={inputStyle}
          />
        ) : (
          <strong>{material.name}</strong>
        )}
        {error && <p style={{ color: '#dc2626', fontSize: 12 }}>{error}</p>}
      </td>
      <td style={tdStyle}>
        {editing ? (
          <select
            value={local.category}
            onChange={(event) => setLocal({ ...local, category: event.target.value })}
            style={inputStyle}
          >
            <option value="tongzhu">通珠</option>
            <option value="yaopian">药片</option>
          </select>
        ) : (
          material.category
        )}
      </td>
      <td style={tdStyle}>
        {editing ? (
          <input
            value={local.price}
            onChange={(event) => setLocal({ ...local, price: event.target.value })}
            style={inputStyle}
          />
        ) : (
          `¥${material.price}`
        )}
      </td>
      <td style={tdStyle}>
        {editing ? (
          <input
            value={local.weight}
            onChange={(event) => setLocal({ ...local, weight: event.target.value })}
            style={inputStyle}
          />
        ) : (
          `${material.weight} g`
        )}
      </td>
      <td style={tdStyle}>
        {editing ? (
          <input
            value={local.max_quantity}
            onChange={(event) => setLocal({ ...local, max_quantity: event.target.value })}
            style={inputStyle}
          />
        ) : (
          material.max_quantity ?? '-'
        )}
      </td>
      <td style={tdStyle}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={material.published}
            onChange={(event) => handleToggle(event.target.checked)}
          />
          {material.published ? '已上架' : '下架'}
        </label>
      </td>
      <td style={{ ...tdStyle, minWidth: 160 }}>
        {editing ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                background: '#111827',
                color: '#fff'
              }}
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#fff'
              }}
            >
              取消
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff'
            }}
          >
            编辑
          </button>
        )}
      </td>
    </tr>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 14
}

const thStyle: React.CSSProperties = {
  padding: '12px 8px',
  borderBottom: '1px solid #e5e7eb',
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: 0.5
}

const tdStyle: React.CSSProperties = {
  padding: '12px 8px',
  borderBottom: '1px solid #f1f5f9',
  verticalAlign: 'top'
}
