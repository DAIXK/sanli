const requireEnv = (key: string): string => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`)
  }
  return value
}

export const getDatabaseUrl = () => requireEnv('DATABASE_URL')
export const getJwtSecret = () => requireEnv('JWT_SECRET')
