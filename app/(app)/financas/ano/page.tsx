import { createClient, getUser } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import type { Aporte, Cartao, Despesa, DizimoDevolvido, FaturaPaga, Lancamento, Plano, Receita, Renda } from '@/lib/financas'
import AnoClient from './ano-client'

export default async function AnoPage({ searchParams }: { searchParams: { ano?: string } }) {
  const supabase = await createClient()
  const [user, familiaId] = await Promise.all([getUser(), obterFamilia(supabase)])

  const ano = /^\d{4}$/.test(searchParams.ano ?? '') ? Number(searchParams.ano) : new Date().getFullYear()
  // Dezembro do ano anterior entra porque a fatura dele pode vencer em janeiro
  const de = `${ano - 1}-12-01`
  const ate = `${ano}-12-01`

  const [{ data: lancamentos }, { data: despesas }, { data: cartoes }, { data: rendas }, { data: faturasPagas }, { data: dizimoConfig }, { data: dizimos }, { data: receitas }, { data: planos }, { data: aportes }] =
    await Promise.all([
      supabase.from('fin_lancamentos').select('*').eq('familia_id', familiaId).gte('competencia', de).lte('competencia', ate)
        .order('data', { ascending: false }),
      supabase.from('fin_despesas').select('*').eq('familia_id', familiaId),
      supabase.from('fin_cartoes').select('*').eq('familia_id', familiaId).order('created_at'),
      supabase.from('fin_rendas').select('*').eq('familia_id', familiaId),
      supabase.from('fin_faturas').select('cartao_id, competencia').eq('familia_id', familiaId).gte('competencia', de).lte('competencia', ate),
      supabase.from('fin_familias').select('dizimo_desde').eq('id', familiaId).maybeSingle(),
      supabase.from('fin_dizimos').select('competencia, valor, devolvido_em').eq('familia_id', familiaId).lte('competencia', ate),
      supabase.from('fin_receitas').select('*').eq('familia_id', familiaId).gte('competencia', de).lte('competencia', ate),
      supabase.from('fin_planos').select('*').eq('familia_id', familiaId).order('created_at'),
      supabase.from('fin_aportes').select('*').eq('familia_id', familiaId).gte('competencia', de).lte('competencia', ate),
    ])

  return (
    <AnoClient
      key={ano}
      ano={ano}
      familiaId={familiaId}
      userId={user!.id}
      lancamentos={(lancamentos ?? []) as Lancamento[]}
      despesas={(despesas ?? []) as Despesa[]}
      cartoes={(cartoes ?? []) as Cartao[]}
      rendas={(rendas ?? []) as Renda[]}
      receitas={(receitas ?? []) as Receita[]}
      planos={(planos ?? []) as Plano[]}
      aportes={(aportes ?? []) as Aporte[]}
      faturasPagas={(faturasPagas ?? []) as FaturaPaga[]}
      dizimoDesde={(dizimoConfig?.dizimo_desde as string | undefined) ?? null}
      dizimos={(dizimos ?? []) as DizimoDevolvido[]}
    />
  )
}
