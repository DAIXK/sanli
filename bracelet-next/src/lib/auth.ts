import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getJwtSecret } from './env'

export interface AdminSession {
  sub: string
  email: string
  name?: string | null
}

const SESSION_COOKIE = 'admin-token'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
const shouldUseSecureCookie = () =>
  process.env.NEXT_FORCE_SECURE_COOKIE === '1' || process.env.NODE_ENV === 'production'

export const createAdminToken = (payload: AdminSession) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: SESSION_MAX_AGE })
}

export const parseAdminToken = (token?: string | null): AdminSession | null => {
  if (!token) return null
  try {
    return jwt.verify(token, getJwtSecret()) as AdminSession
  } catch (error) {
    console.warn('Invalid admin token', error)
    return null
  }
}

export const getAdminSession = (): AdminSession | null => {
  const token = cookies().get(SESSION_COOKIE)?.value
  return parseAdminToken(token)
}

export const requireAdminSession = (): AdminSession => {
  const session = getAdminSession()
  if (!session) {
    redirect('/admin/login')
  }
  return session
}

export const setAdminSession = (session: AdminSession) => {
  const token = createAdminToken(session)
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookie(),
    maxAge: SESSION_MAX_AGE,
    path: '/'
  })
}

export const clearAdminSession = () => {
  cookies().set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookie(),
    expires: new Date(0),
    path: '/'
  })
}

export const getApiAdminSession = (): AdminSession | null => getAdminSession()
