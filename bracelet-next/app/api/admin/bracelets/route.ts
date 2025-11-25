import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getApiAdminSession } from '@/lib/auth'
import { query } from '@/lib/db'
import type { BraceletRecord } from '@/types/material'

const braceletSchema = z.object({
  name: z.string().min(1),
  max_beads: z.coerce.number().int().positive(),
  base_model: z.string().url().optional().nullable(),
  description: z.string().optional().nullable()
})

const unauthorized = () => NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

export async function GET() {
  if (!getApiAdminSession()) {
    return unauthorized()
  }
  try {
    const { rows } = await query<BraceletRecord>('SELECT * FROM bracelets ORDER BY name ASC')
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Failed to load bracelets', error)
    return NextResponse.json({ message: '加载失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!getApiAdminSession()) {
    return unauthorized()
  }
  const payload = await request.json()
  const parsed = braceletSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ message: '参数错误', issues: parsed.error.format() }, { status: 400 })
  }
  try {
    const { rows } = await query<BraceletRecord>(
      `INSERT INTO bracelets (name, max_beads, base_model, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        parsed.data.name,
        parsed.data.max_beads,
        parsed.data.base_model ?? null,
        parsed.data.description ?? null
      ]
    )
    return NextResponse.json(rows[0])
  } catch (error) {
    console.error('Failed to create bracelet', error)
    return NextResponse.json({ message: '创建失败' }, { status: 500 })
  }
}
