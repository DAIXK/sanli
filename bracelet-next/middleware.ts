import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const ADMIN_COOKIE = 'admin-token'
const encoder = new TextEncoder()
const PUBLIC_ADMIN_ROUTES = ['/admin/login']
const PUBLIC_ADMIN_APIS = ['/api/admin/login']

const verifyToken = async (token?: string | null) => {
  if (!token) return false
  const secret = process.env.JWT_SECRET
  if (!secret) return false
  try {
    await jwtVerify(token, encoder.encode(secret))
    return true
  } catch (error) {
    console.warn('Invalid admin token', error)
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(ADMIN_COOKIE)?.value
  const isAdminRoute = pathname.startsWith('/admin')
  const isAdminApi = pathname.startsWith('/api/admin')

  if (isAdminRoute && !PUBLIC_ADMIN_ROUTES.includes(pathname)) {
    const valid = await verifyToken(token)
    if (!valid) {
      const loginUrl = new URL('/admin/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  if (isAdminApi && !PUBLIC_ADMIN_APIS.includes(pathname)) {
    const valid = await verifyToken(token)
    if (!valid) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
}
