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
