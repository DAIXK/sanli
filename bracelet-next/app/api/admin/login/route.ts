import { compare } from 'bcryptjs'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { setAdminSession } from '@/lib/auth'
import { query } from '@/lib/db'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

interface AdminUserRow {
  id: string
  email: string
  name?: string | null
  password_hash?: string | null
}

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid payload' }, { status: 400 })
  }
  const { email, password } = parsed.data

  try {
    const { rows } = await query<AdminUserRow>(
      'SELECT id, email, name, password_hash FROM admin_users WHERE lower(email) = $1 LIMIT 1',
      [email.toLowerCase()]
    )
    const admin = rows[0]
    if (!admin) {
      return NextResponse.json({ message: '账号或密码错误' }, { status: 401 })
    }
    const valid = await compare(password, admin.password_hash || '')
    if (!valid) {
      return NextResponse.json({ message: '账号或密码错误' }, { status: 401 })
    }

    setAdminSession({
      sub: admin.id,
      email: admin.email,
      name: admin.name
    })

    return NextResponse.json({ id: admin.id, email: admin.email, name: admin.name })
  } catch (error) {
    console.error('Admin login failed', error)
    return NextResponse.json({ message: '服务器错误' }, { status: 500 })
  }
}
