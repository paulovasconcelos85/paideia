import { createClient } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import { buscarPtax } from '@/lib/cambio'
import type { Despesa, Plano, Renda } from '@/lib/financas'
import { diagnosticar } from '@/lib/financas-diagnostico'
import PlanosClient from './planos-client'

export default async function PlanosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const familiaId = await obterFamilia(supabase)

  const [{ data: planos }, { data: despesas }, { data: rendas }, ptax] = await Promise.all([
    supabase.from('fin_planos').select('*').eq('familia_id', familiaId)
      .order('prioridade', { ascending: false }).order('created_at'),
    supabase.from('fin_despesas').select('*').eq('familia_id', familiaId),
    supabase.from('fin_rendas').select('*').eq('familia_id', familiaId),
    buscarPtax(),
  ])

  const { saldo } = diagnosticar((despesas ?? []) as Despesa[], (rendas ?? []) as Renda[])

  return <PlanosClient userId={user!.id} familiaId={familiaId} planos={((planos ?? []) as Plano[]).map(p => p.moeda === 'USD' && !p.cotacao && ptax ? { ...p, cotacao: ptax.venda } : p)} saldoMensal={saldo} />
}
