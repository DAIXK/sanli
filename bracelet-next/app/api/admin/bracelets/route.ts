import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getApiAdminSession } from '@/lib/auth'
import { createSupabaseServiceClient } from '@/lib/supabase'

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
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.from('bracelets').select('*').order('name', { ascending: true })
  if (error) {
    console.error('Failed to load bracelets', error)
    return NextResponse.json({ message: '加载失败' }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
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
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.from('bracelets').insert(parsed.data).select().single()
  if (error) {
    console.error('Failed to create bracelet', error)
    return NextResponse.json({ message: '创建失败' }, { status: 500 })
  }
  return NextResponse.json(data)
}
