import { createClient, getUser } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import { buscarPtax } from '@/lib/cambio'
import { comAportado, type Aporte, type Plano } from '@/lib/financas'
import { sobraDoMes } from '@/lib/sobra'
import PlanosClient from './planos-client'

export default async function PlanosPage() {
  const supabase = await createClient()
  const [user, familiaId] = await Promise.all([getUser(), obterFamilia(supabase)])

  const [{ data: planos }, { data: aportes }, { data: compras }, ptax, sobra] = await Promise.all([
    supabase.from('fin_planos').select('*').eq('familia_id', familiaId).order('prioridade', { ascending: false }).order('created_at'),
    supabase.from('fin_aportes').select('plano_id, valor, pago').eq('familia_id', familiaId),
    supabase.from('fin_compras_dolar').select('valor_usd').eq('familia_id', familiaId),
    buscarPtax(),
    sobraDoMes(supabase, familiaId),
  ])

  const dolarGuardado = (compras ?? []).reduce((a, c) => a + Number(c.valor_usd), 0)
  const lista = ((planos ?? []) as Plano[]).map(p => (p.moeda === 'USD' && !p.cotacao && ptax ? { ...p, cotacao: ptax.venda } : p))

  return (
    <PlanosClient
      userId={user!.id}
      familiaId={familiaId}
      planos={comAportado(lista, (aportes ?? []) as Pick<Aporte, 'plano_id' | 'valor' | 'pago'>[], dolarGuardado)}
      sobra={sobra}
    />
  )
}
