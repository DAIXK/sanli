import type {
  GlobalSettings,
  MaterialRecord,
  BraceletRecord
} from '@/types/material'
import { query } from './db'

export const fetchMaterials = async (): Promise<MaterialRecord[]> => {
  const { rows } = await query<MaterialRecord>(
    'SELECT * FROM materials ORDER BY updated_at DESC NULLS LAST'
  )
  return rows
}

export const fetchGlobalSettings = async (): Promise<GlobalSettings | null> => {
  const { rows } = await query<GlobalSettings>('SELECT * FROM global_settings LIMIT 1')
  return rows[0] ?? null
}

export const fetchBracelets = async (): Promise<BraceletRecord[]> => {
  const { rows } = await query<BraceletRecord>(
    'SELECT * FROM bracelets ORDER BY name ASC'
  )
  return rows
}
