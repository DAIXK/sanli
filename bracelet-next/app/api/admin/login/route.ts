import { compare } from 'bcryptjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { setAdminSession } from '@/lib/auth'
import { createSupabaseServiceClient } from '@/lib/supabase'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid payload' }, { status: 400 })
  }
  const { email, password } = parsed.data
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('admin_users')
    .select('id,email,name,password_hash')
    .eq('email', email.toLowerCase())
    .single()

  if (error || !data) {
    console.warn('Admin login failed', error)
    return NextResponse.json({ message: '账号或密码错误' }, { status: 401 })
  }
  const valid = await compare(password, data.password_hash || '')
  if (!valid) {
    return NextResponse.json({ message: '账号或密码错误' }, { status: 401 })
  }

  setAdminSession({
    sub: data.id,
    email: data.email,
    name: data.name
  })

  return NextResponse.json({ id: data.id, email: data.email, name: data.name })
}
