import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import { buscarPtax } from '@/lib/cambio'
import type { Despesa, Plano, Renda } from '@/lib/financas'
import { diagnosticar } from '@/lib/financas-diagnostico'
import PlanoDetalhe from './plano-detalhe'

export default async function PlanoPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const familiaId = await obterFamilia(supabase)

  const [{ data: plano }, { data: outros }, { data: despesas }, { data: rendas }, ptax] = await Promise.all([
    supabase.from('fin_planos').select('*').eq('id', params.id).eq('familia_id', familiaId).maybeSingle(),
    supabase.from('fin_planos').select('aporte_mensal').eq('familia_id', familiaId).eq('status', 'ativo').neq('id', params.id),
    supabase.from('fin_despesas').select('*').eq('familia_id', familiaId),
    supabase.from('fin_rendas').select('*').eq('familia_id', familiaId),
    buscarPtax(),
  ])

  if (!plano) notFound()

  const { saldo } = diagnosticar((despesas ?? []) as Despesa[], (rendas ?? []) as Renda[])
  const aportesOutros = (outros ?? []).reduce((a, p) => a + Number(p.aporte_mensal), 0)

  return <PlanoDetalhe plano={plano as Plano} saldoMensal={saldo} aportesOutros={aportesOutros} ptax={ptax?.venda ?? null} />
}
