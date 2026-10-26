import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Despesa, Plano, Renda } from '@/lib/financas'
import { diagnosticar } from '@/lib/financas-diagnostico'
import PlanoDetalhe from './plano-detalhe'

export default async function PlanoPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: plano }, { data: outros }, { data: despesas }, { data: rendas }] = await Promise.all([
    supabase.from('fin_planos').select('*').eq('id', params.id).eq('user_id', user!.id).maybeSingle(),
    supabase.from('fin_planos').select('aporte_mensal').eq('user_id', user!.id).eq('status', 'ativo').neq('id', params.id),
    supabase.from('fin_despesas').select('*').eq('user_id', user!.id),
    supabase.from('fin_rendas').select('*').eq('user_id', user!.id),
  ])

  if (!plano) notFound()

  const { saldo } = diagnosticar((despesas ?? []) as Despesa[], (rendas ?? []) as Renda[])
  const aportesOutros = (outros ?? []).reduce((a, p) => a + Number(p.aporte_mensal), 0)

  return <PlanoDetalhe plano={plano as Plano} saldoMensal={saldo} aportesOutros={aportesOutros} />
}
