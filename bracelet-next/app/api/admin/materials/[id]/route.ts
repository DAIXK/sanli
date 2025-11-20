import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getApiAdminSession } from '@/lib/auth'
import { createSupabaseServiceClient } from '@/lib/supabase'

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
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('materials')
    .update(parsed.data)
    .eq('id', params.id)
    .select()
    .single()
  if (error) {
    console.error('Failed to update material', error)
    return NextResponse.json({ message: '更新失败' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!getApiAdminSession()) {
    return unauthorized()
  }
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('materials').delete().eq('id', params.id)
  if (error) {
    console.error('Failed to delete material', error)
    return NextResponse.json({ message: '删除失败' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
