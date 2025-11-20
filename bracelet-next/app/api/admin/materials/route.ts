import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getApiAdminSession } from '@/lib/auth'
import { createSupabaseServiceClient } from '@/lib/supabase'

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
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) {
    console.error('Failed to load materials', error)
    return NextResponse.json({ message: '加载失败' }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
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
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.from('materials').insert(parsed.data).select().single()
  if (error) {
    console.error('Failed to create material', error)
    return NextResponse.json({ message: '创建失败' }, { status: 500 })
  }
  return NextResponse.json(data)
}
