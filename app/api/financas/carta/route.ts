import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import { carregarAiConfig } from '@/lib/ai'
import { buscarPtax } from '@/lib/cambio'
import { gerarCarta } from '@/lib/carta'

export const maxDuration = 60

// Escreve a carta do mês sob demanda (o cron do dia 1 faz isso sozinho)
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const aiConfig = await carregarAiConfig(supabase, user.id)
  if ('error' in aiConfig) return NextResponse.json({ error: aiConfig.error }, { status: 400 })

  const familiaId = await obterFamilia(supabase)
  try {
    const ptax = await buscarPtax()
    const carta = await gerarCarta(supabase, familiaId, aiConfig, ptax?.venda ?? null)
    if (!carta) return NextResponse.json({ error: 'Ainda não há dados suficientes para a carta.' }, { status: 400 })
    return NextResponse.json({ carta })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
