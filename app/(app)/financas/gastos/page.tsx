import { createClient, getUser } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import {
  competenciaISO, planoPrincipal, rendaMensal,
  type Cartao, type Despesa, type Lancamento, type Plano, type Renda,
} from '@/lib/financas'
import GastosClient from './gastos-client'

export default async function GastosPage() {
  const supabase = await createClient()
  const [user, familiaId] = await Promise.all([getUser(), obterFamilia(supabase)])

  const [{ data: despesas }, { data: cartoes }, { data: lancamentos }, { data: planos }, { data: rendas }] = await Promise.all([
    supabase.from('fin_despesas').select('*').eq('familia_id', familiaId).order('valor', { ascending: false }),
    supabase.from('fin_cartoes').select('*').eq('familia_id', familiaId).order('created_at'),
    // Fatura real do mês: tudo o que foi lançado nos cartões (à mão ou pela importação)
    supabase.from('fin_lancamentos').select('*').eq('familia_id', familiaId)
      .eq('competencia', competenciaISO()).not('cartao_id', 'is', null)
      .order('data', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('fin_planos').select('*').eq('familia_id', familiaId),
    supabase.from('fin_rendas').select('*').eq('familia_id', familiaId),
  ])

  return (
    <GastosClient
      userId={user!.id}
      familiaId={familiaId}
      despesas={(despesas ?? []) as Despesa[]}
      cartoes={(cartoes ?? []) as Cartao[]}
      lancamentosMes={(lancamentos ?? []) as Lancamento[]}
      plano={planoPrincipal((planos ?? []) as Plano[])}
      renda={((rendas ?? []) as Renda[]).reduce((a, r) => a + rendaMensal(r), 0)}
    />
  )
}
