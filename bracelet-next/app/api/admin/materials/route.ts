import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getApiAdminSession } from '@/lib/auth'
import { query } from '@/lib/db'
import type { MaterialRecord } from '@/types/material'

const rotationAxisEnum = z.enum(['radial', 'tangent', 'normal']).optional().nullable()

const materialPayloadSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  weight: z.coerce.number().nonnegative(),
  price: z.coerce.number().nonnegative(),
  max_quantity: z.coerce.number().int().nonnegative().optional(),
  published: z.boolean().optional().default(true),
  model_url: z.string().url(),
  thumbnail_url: z
    .union([z.string().url(), z.literal('').transform(() => null)])
    .optional()
    .nullable(),
  rotation: z.coerce.number().optional().nullable(),
  rotation_axis: rotationAxisEnum
})

const unauthorized = () => NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

export async function GET() {
  if (!getApiAdminSession()) {
    return unauthorized()
  }
  try {
    const { rows } = await query<MaterialRecord>(
      'SELECT * FROM materials ORDER BY updated_at DESC NULLS LAST'
    )
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Failed to load materials', error)
    return NextResponse.json({ message: '加载失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!getApiAdminSession()) {
    return unauthorized()
  }
  const json = await request.json()
  const parsed = materialPayloadSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ message: '参数错误', issues: parsed.error.format() }, { status: 400 })
  }
  try {
    const { rows } = await query<MaterialRecord>(
      `INSERT INTO materials
        (name, category, weight, price, max_quantity, published, model_url, thumbnail_url, rotation, rotation_axis)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        parsed.data.name,
        parsed.data.category,
        parsed.data.weight,
        parsed.data.price,
        parsed.data.max_quantity ?? null,
        parsed.data.published ?? true,
        parsed.data.model_url,
        parsed.data.thumbnail_url ?? null,
        parsed.data.rotation ?? null,
        parsed.data.rotation_axis ?? null
      ]
    )
    return NextResponse.json(rows[0])
  } catch (error) {
    console.error('Failed to create material', error)
    return NextResponse.json({ message: '创建失败' }, { status: 500 })
  }
}
