import type {
  GlobalSettings,
  MaterialRecord,
  BraceletRecord
} from '@/types/material'
import { createSupabaseServiceClient } from './supabase'

export const fetchMaterials = async (): Promise<MaterialRecord[]> => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) {
    throw error
  }
  return data ?? []
}

export const fetchGlobalSettings = async (): Promise<GlobalSettings | null> => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.from('global_settings').select('*').single()
  if (error && error.code !== 'PGRST116') {
    throw error
  }
  return data ?? null
}

export const fetchBracelets = async (): Promise<BraceletRecord[]> => {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.from('bracelets').select('*').order('name', { ascending: true })
  if (error && error.code !== 'PGRST116') {
    throw error
  }
  return data ?? []
}
