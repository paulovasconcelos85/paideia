import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getDevocionalDoDia } from '@/lib/devocional'

// cron diário: busca o devocional do site externo e salva no Supabase
export async function GET() {
  let devocional
  try {
    devocional = await getDevocionalDoDia()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'erro desconhecido ao buscar o devocional'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  let role: string | null = null
  try {
    role = serviceKey ? JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64').toString()).role : null
  } catch {
    role = 'não foi possível decodificar'
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey!
  )

  const hoje = new Date().toISOString().slice(0, 10)

  const { error } = await supabase
    .from('devocional_dia')
    .upsert({ data: hoje, titulo: devocional.titulo, texto: devocional.texto }, { onConflict: 'data' })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message, debugRole: role, hasKey: !!serviceKey }, { status: 500 })
  }

  return NextResponse.json({ ok: true, data: hoje, titulo: devocional.titulo })
}
