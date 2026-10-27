import { createClient, getUser } from '@/lib/supabase/server'
import { historicoPatrimonio, obterFamilia } from '@/lib/familia'
import { buscarPtax } from '@/lib/cambio'
import type { Despesa, Fechamento, Renda } from '@/lib/financas'
import { diagnosticar } from '@/lib/financas-diagnostico'
import { carregarPatrimonio } from '@/lib/patrimonio'
import PatrimonioClient from './patrimonio-client'

export default async function PatrimonioPage() {
  const supabase = await createClient()
  const [user, familiaId] = await Promise.all([getUser(), obterFamilia(supabase)])

  const ptaxPromise = buscarPtax()
  const [ptax, patrimonio, { data: despesas }, { data: rendas }] = await Promise.all([
    ptaxPromise,
    carregarPatrimonio(supabase, familiaId, ptaxPromise.then(p => p?.venda ?? null)),
    supabase.from('fin_despesas').select('*').eq('familia_id', familiaId),
    supabase.from('fin_rendas').select('*').eq('familia_id', familiaId),
  ])

  const historico: Fechamento[] = patrimonio.temDados
    ? await historicoPatrimonio(supabase, familiaId, patrimonio.ativos, patrimonio.passivos)
    : []

  const { saldo } = diagnosticar((despesas ?? []) as Despesa[], (rendas ?? []) as Renda[])

  return (
    <PatrimonioClient
      familiaId={familiaId}
      userId={user!.id}
      contas={patrimonio.contas}
      dividas={patrimonio.dividas}
      compras={patrimonio.compras}
      ptax={ptax}
      historico={historico}
      sobraMensal={Math.max(saldo, 0)}
    />
  )
}
