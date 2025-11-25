import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getApiAdminSession } from '@/lib/auth'
import { query } from '@/lib/db'
import type { BraceletRecord } from '@/types/material'

const braceletUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  max_beads: z.coerce.number().int().positive().optional(),
  base_model: z.string().url().optional().nullable(),
  description: z.string().optional().nullable()
})

const unauthorized = () => NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!getApiAdminSession()) {
    return unauthorized()
  }
  const payload = await request.json()
  const parsed = braceletUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ message: '参数错误', issues: parsed.error.format() }, { status: 400 })
  }
  const entries = Object.entries(parsed.data).filter(([, value]) => value !== undefined)
  if (entries.length === 0) {
    return NextResponse.json({ message: '无可更新内容' }, { status: 400 })
  }
  try {
    const { rows } = await query<BraceletRecord>(
      `UPDATE bracelets SET ${entries
        .map(([key], index) => `${key} = $${index + 1}`)
        .join(', ')} WHERE id = $${entries.length + 1} RETURNING *`,
      [...entries.map(([, value]) => value ?? null), params.id]
    )
    const updated = rows[0]
    if (!updated) {
      console.error('Failed to update bracelet: no rows returned')
      return NextResponse.json({ message: '更新失败' }, { status: 500 })
    }
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update bracelet', error)
    return NextResponse.json({ message: '更新失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!getApiAdminSession()) {
    return unauthorized()
  }
  try {
    await query('DELETE FROM bracelets WHERE id = $1', [params.id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete bracelet', error)
    return NextResponse.json({ message: '删除失败' }, { status: 500 })
  }
}
