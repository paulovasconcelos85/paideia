import { createClient } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import {
  competenciaISO, planoPrincipal, rendaMensal,
  type Cartao, type Despesa, type Lancamento, type Plano, type Renda,
} from '@/lib/financas'
import MesClient from './mes-client'

export default async function MesPage({ searchParams }: { searchParams: { mes?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const familiaId = await obterFamilia(supabase)

  const competencia = /^\d{4}-\d{2}$/.test(searchParams.mes ?? '') ? `${searchParams.mes}-01` : competenciaISO()

  const [{ data: familia }, { data: lancamentos }, { data: cartoes }, { data: despesas }, { data: rendas }, { data: planos }] =
    await Promise.all([
      supabase.from('fin_familias').select('tetos').eq('id', familiaId).single(),
      supabase.from('fin_lancamentos').select('*').eq('familia_id', familiaId).eq('competencia', competencia)
        .order('data', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('fin_cartoes').select('*').eq('familia_id', familiaId).order('created_at'),
      supabase.from('fin_despesas').select('*').eq('familia_id', familiaId),
      supabase.from('fin_rendas').select('*').eq('familia_id', familiaId),
      supabase.from('fin_planos').select('*').eq('familia_id', familiaId),
    ])

  return (
    <MesClient
      key={competencia}
      familiaId={familiaId}
      userId={user!.id}
      competencia={competencia}
      tetos={(familia?.tetos ?? {}) as Record<string, number>}
      lancamentos={(lancamentos ?? []) as Lancamento[]}
      cartoes={(cartoes ?? []) as Cartao[]}
      despesas={(despesas ?? []) as Despesa[]}
      plano={planoPrincipal((planos ?? []) as Plano[])}
      renda={((rendas ?? []) as Renda[]).reduce((a, r) => a + rendaMensal(r), 0)}
    />
  )
}
