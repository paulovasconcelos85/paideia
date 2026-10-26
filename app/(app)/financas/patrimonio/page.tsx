import { createClient } from '@/lib/supabase/server'
import { obterFamilia, registrarFechamento } from '@/lib/familia'
import { buscarPtax } from '@/lib/cambio'
import type { Despesa, Fechamento, Renda } from '@/lib/financas'
import { diagnosticar } from '@/lib/financas-diagnostico'
import { carregarPatrimonio } from '@/lib/patrimonio'
import PatrimonioClient from './patrimonio-client'

export default async function PatrimonioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const familiaId = await obterFamilia(supabase)

  const ptax = await buscarPtax()
  const [patrimonio, { data: despesas }, { data: rendas }] = await Promise.all([
    carregarPatrimonio(supabase, familiaId, ptax?.venda ?? null),
    supabase.from('fin_despesas').select('*').eq('familia_id', familiaId),
    supabase.from('fin_rendas').select('*').eq('familia_id', familiaId),
  ])

  if (patrimonio.temDados) {
    await registrarFechamento(supabase, familiaId, patrimonio.ativos, patrimonio.passivos)
  }

  const { data: fechamentos } = await supabase
    .from('fin_fechamentos')
    .select('mes, ativos, dividas')
    .eq('familia_id', familiaId)
    .order('mes', { ascending: false })
    .limit(12)

  const { saldo } = diagnosticar((despesas ?? []) as Despesa[], (rendas ?? []) as Renda[])

  return (
    <PatrimonioClient
      familiaId={familiaId}
      userId={user!.id}
      contas={patrimonio.contas}
      dividas={patrimonio.dividas}
      compras={patrimonio.compras}
      ptax={ptax}
      historico={((fechamentos ?? []) as Fechamento[]).reverse()}
      sobraMensal={Math.max(saldo, 0)}
    />
  )
}
