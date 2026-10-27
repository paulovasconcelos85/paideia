import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { obterFamilia } from '@/lib/familia'
import { buscarPtax } from '@/lib/cambio'
import { comAportado, type Aporte, type Plano } from '@/lib/financas'
import { sobraDoMes } from '@/lib/sobra'
import PlanoDetalhe from './plano-detalhe'

export default async function PlanoPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createClient()
  const familiaId = await obterFamilia(supabase)

  const [{ data: plano }, { data: outros }, { data: aportes }, { data: compras }, ptax, sobra] = await Promise.all([
    supabase.from('fin_planos').select('*').eq('id', params.id).eq('familia_id', familiaId).maybeSingle(),
    supabase.from('fin_planos').select('aporte_mensal').eq('familia_id', familiaId).eq('status', 'ativo').neq('id', params.id),
    supabase.from('fin_aportes').select('plano_id, valor, pago, competencia').eq('plano_id', params.id).order('competencia', { ascending: false }),
    supabase.from('fin_compras_dolar').select('valor_usd').eq('familia_id', familiaId),
    buscarPtax(),
    sobraDoMes(supabase, familiaId),
  ])

  if (!plano) notFound()

  const dolarGuardado = (compras ?? []).reduce((a, c) => a + Number(c.valor_usd), 0)
  const listaAportes = (aportes ?? []) as Pick<Aporte, 'plano_id' | 'valor' | 'pago' | 'competencia'>[]
  const [comGuardado] = comAportado([plano as Plano], listaAportes, dolarGuardado)
  const aportesOutros = (outros ?? []).reduce((a, p) => a + Number(p.aporte_mensal), 0)

  return (
    <PlanoDetalhe
      plano={comGuardado}
      sobra={sobra.sobra}
      aportesOutros={aportesOutros}
      ptax={ptax?.venda ?? null}
      dolarGuardado={dolarGuardado}
      aportesPagos={listaAportes.filter(a => a.pago).reduce((s, a) => s + Number(a.valor), 0)}
      mesesComAporte={listaAportes.filter(a => a.pago).length}
    />
  )
}
