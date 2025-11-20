import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getApiAdminSession } from '@/lib/auth'
import { createSupabaseServiceClient } from '@/lib/supabase'

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
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('bracelets')
    .update(parsed.data)
    .eq('id', params.id)
    .select()
    .single()
  if (error) {
    console.error('Failed to update bracelet', error)
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
  const { error } = await supabase.from('bracelets').delete().eq('id', params.id)
  if (error) {
    console.error('Failed to delete bracelet', error)
    return NextResponse.json({ message: '删除失败' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
