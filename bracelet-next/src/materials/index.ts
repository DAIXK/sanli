import type { MaterialConfig } from '../types/material'
import tongzhu from './tongzhu'
import yaopian from './yaopian'

const normalizeMaterialConfig = (config: unknown): MaterialConfig => {
  if (!config || typeof config !== 'object') {
    return {}
  }
  return config as MaterialConfig
}

export const loadLocalMaterials = async (): Promise<MaterialConfig> => {
  const merged: MaterialConfig = {
    ...normalizeMaterialConfig(tongzhu),
    ...normalizeMaterialConfig(yaopian)
  }
  return merged
}

export type { MaterialConfig }
