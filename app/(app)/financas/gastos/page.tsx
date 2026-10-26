import { createClient } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import { competenciaISO, type Cartao, type Despesa, type Lancamento } from '@/lib/financas'
import GastosClient from './gastos-client'

export default async function GastosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const familiaId = await obterFamilia(supabase)

  const [{ data: despesas }, { data: cartoes }, { data: lancamentos }] = await Promise.all([
    supabase.from('fin_despesas').select('*').eq('familia_id', familiaId).order('valor', { ascending: false }),
    supabase.from('fin_cartoes').select('*').eq('familia_id', familiaId).order('created_at'),
    supabase.from('fin_lancamentos').select('cartao_id, valor').eq('familia_id', familiaId)
      .eq('competencia', competenciaISO()).not('cartao_id', 'is', null),
  ])

  // Fatura real do mês por cartão: soma do que foi lançado (à mão ou pela importação)
  const realPorCartao = ((lancamentos ?? []) as Pick<Lancamento, 'cartao_id' | 'valor'>[]).reduce<Record<string, number>>((acc, l) => {
    acc[l.cartao_id!] = (acc[l.cartao_id!] ?? 0) + Number(l.valor)
    return acc
  }, {})

  return (
    <GastosClient
      userId={user!.id}
      familiaId={familiaId}
      despesas={(despesas ?? []) as Despesa[]}
      cartoes={(cartoes ?? []) as Cartao[]}
      realPorCartao={realPorCartao}
    />
  )
}
