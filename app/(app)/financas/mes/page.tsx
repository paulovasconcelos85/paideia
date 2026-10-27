import { createClient, getUser } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import {
  competenciaISO, planoPrincipal, rendaMensal, somarMeses,
  type Cartao, type Despesa, type FaturaPaga, type Lancamento, type Plano, type Renda,
} from '@/lib/financas'
import MesClient from './mes-client'

export default async function MesPage({ searchParams }: { searchParams: { mes?: string; cartao?: string } }) {
  const supabase = await createClient()
  const [user, familiaId] = await Promise.all([getUser(), obterFamilia(supabase)])

  const competencia = /^\d{4}-\d{2}$/.test(searchParams.mes ?? '') ? `${searchParams.mes}-01` : competenciaISO()

  const anterior = somarMeses(competencia, -1)
  const ehMesAtual = competencia === competenciaISO()

  const [
    { data: familia }, { data: lancamentos }, { data: cartoes }, { data: despesas }, { data: rendas }, { data: planos },
    { data: faturasPagas }, { data: faturaAnterior }, { data: atrasados },
  ] =
    await Promise.all([
      supabase.from('fin_familias').select('tetos').eq('id', familiaId).single(),
      supabase.from('fin_lancamentos').select('*').eq('familia_id', familiaId).eq('competencia', competencia)
        .order('data', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('fin_cartoes').select('*').eq('familia_id', familiaId).order('created_at'),
      supabase.from('fin_despesas').select('*').eq('familia_id', familiaId),
      supabase.from('fin_rendas').select('*').eq('familia_id', familiaId),
      supabase.from('fin_planos').select('*').eq('familia_id', familiaId),
      // Saídas do mês: faturas já pagas, a fatura anterior (pode vencer neste mês) e contas atrasadas
      supabase.from('fin_faturas').select('cartao_id, competencia').eq('familia_id', familiaId).in('competencia', [anterior, competencia]),
      supabase.from('fin_lancamentos').select('cartao_id, valor').eq('familia_id', familiaId).eq('competencia', anterior).not('cartao_id', 'is', null),
      ehMesAtual
        ? supabase.from('fin_lancamentos').select('*').eq('familia_id', familiaId).lt('competencia', competencia)
            .is('cartao_id', null).eq('pago', false).order('vencimento')
        : Promise.resolve({ data: [] }),
    ])

  return (
    <MesClient
      key={competencia}
      familiaId={familiaId}
      userId={user!.id}
      competencia={competencia}
      cartaoInicial={searchParams.cartao ?? null}
      tetos={(familia?.tetos ?? {}) as Record<string, number>}
      lancamentos={(lancamentos ?? []) as Lancamento[]}
      cartoes={(cartoes ?? []) as Cartao[]}
      despesas={(despesas ?? []) as Despesa[]}
      plano={planoPrincipal((planos ?? []) as Plano[])}
      renda={((rendas ?? []) as Renda[]).reduce((a, r) => a + rendaMensal(r), 0)}
      faturasPagas={(faturasPagas ?? []) as FaturaPaga[]}
      faturaAnterior={(faturaAnterior ?? []) as Pick<Lancamento, 'cartao_id' | 'valor'>[]}
      atrasados={(atrasados ?? []) as Lancamento[]}
    />
  )
}
