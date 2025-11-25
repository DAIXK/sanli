import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import type { GlobalSettings, MaterialRecord } from '@/types/material'

export async function GET() {
  try {
    const [{ rows: materials }, { rows: settings }] = await Promise.all([
      query<MaterialRecord>('SELECT * FROM materials WHERE published = true ORDER BY name ASC'),
      query<GlobalSettings>('SELECT * FROM global_settings LIMIT 1')
    ])
    return NextResponse.json({
      materials,
      settings: settings[0] ?? null
    })
  } catch (error) {
    console.error('Failed to load public materials', error)
    return NextResponse.json({ message: '加载失败' }, { status: 500 })
  }
}
