import { NextResponse } from 'next/server'
import { createSupabaseAnonClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createSupabaseAnonClient()
  const [{ data: materials, error: materialsError }, { data: settings, error: settingsError }] =
    await Promise.all([
      supabase.from('materials').select('*').eq('published', true).order('name', { ascending: true }),
      supabase.from('global_settings').select('*').single()
    ])
  if (materialsError || settingsError) {
    console.error('Failed to load public materials', materialsError || settingsError)
    return NextResponse.json({ message: '加载失败' }, { status: 500 })
  }
  return NextResponse.json({
    materials: materials ?? [],
    settings: settings ?? null
  })
}
