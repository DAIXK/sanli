import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getApiAdminSession } from '@/lib/auth'
import { query } from '@/lib/db'
import type { MaterialRecord } from '@/types/material'

const rotationAxisEnum = z.enum(['radial', 'tangent', 'normal']).optional().nullable()

const materialUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  weight: z.coerce.number().nonnegative().optional(),
  price: z.coerce.number().nonnegative().optional(),
  max_quantity: z.coerce.number().int().nonnegative().optional(),
  published: z.boolean().optional(),
  model_url: z.string().url().optional(),
  thumbnail_url: z.union([z.string().url(), z.literal('').transform(() => null)]).optional().nullable(),
  rotation: z.coerce.number().optional().nullable(),
  rotation_axis: rotationAxisEnum
})

const unauthorized = () => NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!getApiAdminSession()) {
    return unauthorized()
  }
  const body = await request.json()
  const parsed = materialUpdateSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: '参数错误', issues: parsed.error.format() }, { status: 400 })
  }
  const entries = Object.entries(parsed.data).filter(([, value]) => value !== undefined)
  if (entries.length === 0) {
    return NextResponse.json({ message: '无可更新内容' }, { status: 400 })
  }
  const setClauses = entries.map(([key], index) => `${key} = $${index + 1}`)
  setClauses.push('updated_at = NOW()')
  try {
    const { rows } = await query<MaterialRecord>(
      `UPDATE materials SET ${setClauses.join(', ')} WHERE id = $${
        entries.length + 1
      } RETURNING *`,
      [...entries.map(([, value]) => value ?? null), params.id]
    )
    const updated = rows[0]
    if (!updated) {
      console.error('Failed to update material: no rows returned')
      return NextResponse.json({ message: '更新失败' }, { status: 500 })
    }
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update material', error)
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
    await query('DELETE FROM materials WHERE id = $1', [params.id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete material', error)
    return NextResponse.json({ message: '删除失败' }, { status: 500 })
  }
}
