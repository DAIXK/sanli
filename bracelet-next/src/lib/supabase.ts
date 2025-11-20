import { createClient } from '@supabase/supabase-js'
import { getSupabaseUrl, getSupabaseAnonKey, getSupabaseServiceKey } from './env'

export const createSupabaseServiceClient = () =>
  createClient(getSupabaseUrl(), getSupabaseServiceKey(), {
    auth: { persistSession: false }
  })

export const createSupabaseAnonClient = () =>
  createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false }
  })
