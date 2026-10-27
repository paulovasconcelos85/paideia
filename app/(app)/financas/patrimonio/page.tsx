import { createClient, getUser } from '@/lib/supabase/server'
import { historicoPatrimonio, obterFamilia } from '@/lib/familia'
import { buscarPtax } from '@/lib/cambio'
import type { Fechamento } from '@/lib/financas'
import { carregarPatrimonio } from '@/lib/patrimonio'
import { sobraDoMes } from '@/lib/sobra'
import PatrimonioClient from './patrimonio-client'

export default async function PatrimonioPage() {
  const supabase = await createClient()
  const [user, familiaId] = await Promise.all([getUser(), obterFamilia(supabase)])

  const ptaxPromise = buscarPtax()
  const [ptax, patrimonio, sobra] = await Promise.all([
    ptaxPromise,
    carregarPatrimonio(supabase, familiaId, ptaxPromise.then(p => p?.venda ?? null)),
    sobraDoMes(supabase, familiaId),
  ])

  const historico: Fechamento[] = patrimonio.temDados
    ? await historicoPatrimonio(supabase, familiaId, patrimonio.ativos, patrimonio.passivos)
    : []

  return (
    <PatrimonioClient
      familiaId={familiaId}
      userId={user!.id}
      contas={patrimonio.contas}
      dividas={patrimonio.dividas}
      parcelas={patrimonio.parcelas}
      semSaldo={patrimonio.semSaldo}
      compras={patrimonio.compras}
      ptax={ptax}
      historico={historico}
      sobraMensal={Math.max(sobra.sobra, 0)}
    />
  )
}
