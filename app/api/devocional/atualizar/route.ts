import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getDevocionalDoDia } from '@/lib/devocional'

// cron diário: busca o devocional do site externo e salva no Supabase
export async function GET() {
  const devocional = await getDevocionalDoDia()

  if (!devocional) {
    return NextResponse.json({ ok: false, error: 'não foi possível obter o devocional' }, { status: 502 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const hoje = new Date().toISOString().slice(0, 10)

  const { error } = await supabase
    .from('devocional_dia')
    .upsert({ data: hoje, titulo: devocional.titulo, texto: devocional.texto }, { onConflict: 'data' })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, data: hoje, titulo: devocional.titulo })
}
