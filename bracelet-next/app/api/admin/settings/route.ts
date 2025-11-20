import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getApiAdminSession } from '@/lib/auth'
import { createSupabaseServiceClient } from '@/lib/supabase'

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
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.from('global_settings').select('*').maybeSingle()
  if (error && error.code !== 'PGRST116') {
    console.error('Failed to fetch settings', error)
    return NextResponse.json({ message: '加载失败' }, { status: 500 })
  }
  return NextResponse.json(data ?? null)
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
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('global_settings')
    .upsert({ id: 1, ...parsed.data })
    .select()
    .single()
  if (error) {
    console.error('Failed to update settings', error)
    return NextResponse.json({ message: '保存失败' }, { status: 500 })
  }
  return NextResponse.json(data)
}
