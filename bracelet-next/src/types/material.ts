export type RotationAxis = 'radial' | 'tangent' | 'normal'

export interface BackgroundOption {
  glb: string
  png?: string
  name?: string
  length?: number | string
  width?: number | string
  radius?: number
  max?: number
}

export interface ProductOption {
  glb: string
  png?: string
  name?: string
  price?: number | string
  weight?: number | string
  width?: number | string
  diameter?: number | string
  type?: string
  rotation?: number
  rotationAxis?: RotationAxis
}

export interface MaterialEntry {
  price?: number | string
  name?: string
  background?: BackgroundOption[]
  product?: ProductOption[]
}

export type MaterialConfig = Record<string, MaterialEntry>

export interface MaterialRecord {
  id: string
  name: string
  category: string
  weight: number
  price: number
  max_quantity?: number
  published: boolean
  model_url: string
  thumbnail_url?: string | null
  rotation?: number | null
  rotation_axis?: RotationAxis | null
  metadata?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

export interface BraceletRecord {
  id: string
  name: string
  max_beads: number
  base_model?: string | null
  description?: string | null
  created_at?: string
  updated_at?: string
}

export interface GlobalSettings {
  gold_price_per_gram: number
  processing_fee: number
  currency?: string
  updated_at?: string
}
