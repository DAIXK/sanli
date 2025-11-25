import { Pool } from 'pg'
import { getDatabaseUrl } from './env'

const globalForPool = global as unknown as { pgPool?: Pool }

const pool =
  globalForPool.pgPool ??
  new Pool({
    connectionString: getDatabaseUrl()
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPool.pgPool = pool
}

export const query = <T = unknown>(text: string, params?: unknown[]) => pool.query<T>(text, params)
