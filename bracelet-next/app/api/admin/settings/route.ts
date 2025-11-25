import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getApiAdminSession } from '@/lib/auth'
import { query } from '@/lib/db'
import type { GlobalSettings } from '@/types/material'

const settingsSchema = z.object({
  gold_price_per_gram: z.coerce.number().nonnegative(),
  processing_fee: z.coerce.number().nonnegative(),
  currency: z.string().default('CNY')
})

const unauthorized = () => NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

export async function GET() {
  if (!getApiAdminSession()) {
    return unauthorized()
  }
  try {
    const { rows } = await query<GlobalSettings>('SELECT * FROM global_settings LIMIT 1')
    return NextResponse.json(rows[0] ?? null)
  } catch (error) {
    console.error('Failed to fetch settings', error)
    return NextResponse.json({ message: '加载失败' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  if (!getApiAdminSession()) {
    return unauthorized()
  }
  const payload = await request.json()
  const parsed = settingsSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ message: '参数错误', issues: parsed.error.format() }, { status: 400 })
  }
  try {
    const { rows } = await query<GlobalSettings>(
      `INSERT INTO global_settings (id, gold_price_per_gram, processing_fee, currency)
       VALUES (1, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE
       SET gold_price_per_gram = EXCLUDED.gold_price_per_gram,
           processing_fee = EXCLUDED.processing_fee,
           currency = EXCLUDED.currency
       RETURNING *`,
      [
        parsed.data.gold_price_per_gram,
        parsed.data.processing_fee,
        parsed.data.currency ?? 'CNY'
      ]
    )
    return NextResponse.json(rows[0])
  } catch (error) {
    console.error('Failed to update settings', error)
    return NextResponse.json({ message: '保存失败' }, { status: 500 })
  }
}
