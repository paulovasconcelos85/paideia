import { createClient } from '@/lib/supabase/server'
import { obterFamilia, registrarFechamento } from '@/lib/familia'
import { buscarPtax } from '@/lib/cambio'
import { carregarPatrimonio } from '@/lib/patrimonio'
import {
  competenciaISO, despesaMensal, planoPrincipal, projetarPlano, rendaMensal,
  type Cartao, type Despesa, type Fechamento, type Lancamento, type Plano, type Renda,
} from '@/lib/financas'
import { diagnosticar } from '@/lib/financas-diagnostico'
import InicioClient from './inicio-client'

export default async function FinancasInicioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const familiaId = await obterFamilia(supabase)
  const competencia = competenciaISO()
  const ptax = await buscarPtax()

  const [
    { data: familia }, { data: despesas }, { data: rendas }, { data: planos }, { data: lancamentos },
    patrimonio, { data: cartoes }, { data: membros }, { data: carta },
  ] = await Promise.all([
    supabase.from('fin_familias').select('tetos').eq('id', familiaId).single(),
    supabase.from('fin_despesas').select('*').eq('familia_id', familiaId),
    supabase.from('fin_rendas').select('*').eq('familia_id', familiaId),
    supabase.from('fin_planos').select('*').eq('familia_id', familiaId),
    supabase.from('fin_lancamentos').select('valor').eq('familia_id', familiaId).eq('competencia', competencia),
    carregarPatrimonio(supabase, familiaId, ptax?.venda ?? null),
    supabase.from('fin_cartoes').select('*').eq('familia_id', familiaId).order('created_at'),
    supabase.rpc('fin_membros_familia'),
    supabase.from('fin_cartas').select('texto').eq('familia_id', familiaId).eq('mes', competencia).maybeSingle(),
  ])

  const listaDespesas = (despesas ?? []) as Despesa[]
  const listaRendas = (rendas ?? []) as Renda[]
  // Planos em dólar sem cotação própria usam a PTAX do dia
  const listaPlanos = ((planos ?? []) as Plano[]).map(p =>
    p.moeda === 'USD' && !p.cotacao && ptax ? { ...p, cotacao: ptax.venda } : p
  )

  // O mês
  const gasto = ((lancamentos ?? []) as Pick<Lancamento, 'valor'>[]).reduce((a, l) => a + Number(l.valor), 0)
  const tetos = (familia?.tetos ?? {}) as Record<string, number>
  const totalTetos = Object.values(tetos).reduce((a, v) => a + Number(v), 0)
  const planejado = totalTetos > 0 ? totalTetos : listaDespesas.reduce((a, d) => a + despesaMensal(d), 0)

  // O placar
  const { ativos, passivos, temDados: temPatrimonio } = patrimonio
  let variacao: number | null = null
  if (temPatrimonio) {
    await registrarFechamento(supabase, familiaId, ativos, passivos)
    const { data: anterior } = await supabase
      .from('fin_fechamentos').select('mes, ativos, dividas')
      .eq('familia_id', familiaId).lt('mes', competencia)
      .order('mes', { ascending: false }).limit(1).maybeSingle()
    const a = anterior as Fechamento | null
    if (a) variacao = (ativos - passivos) - (Number(a.ativos) - Number(a.dividas))
  }

  // O sonho
  const plano = planoPrincipal(listaPlanos)
  const projecao = plano ? projetarPlano(plano) : null

  // O foco: o alerta mais importante do diagnóstico
  const diag = diagnosticar(listaDespesas, listaRendas)
  const foco = diag.alertas.find(a => a.nivel === 'critico' || a.nivel === 'atencao') ?? diag.alertas[0] ?? null

  return (
    <InicioClient
      familiaId={familiaId}
      userId={user!.id}
      cartoes={(cartoes ?? []) as Cartao[]}
      renda={listaRendas.reduce((a, r) => a + rendaMensal(r), 0)}
      mes={{ competencia, gasto, planejado }}
      patrimonio={temPatrimonio ? { liquido: ativos - passivos, variacao } : null}
      plano={plano}
      projecao={projecao && {
        progresso: projecao.progresso,
        dataPrevista: projecao.dataPrevista?.toISOString() ?? null,
        metaDefinida: projecao.metaBRL > 0,
      }}
      foco={foco}
      carta={(carta?.texto as string | undefined) ?? null}
      podeEscreverCarta={listaDespesas.length > 0 || listaRendas.length > 0}
      setup={{
        rendas: listaRendas.length > 0,
        fixos: listaDespesas.length > 0,
        cartoes: (cartoes?.length ?? 0) > 0,
        familia: (membros?.length ?? 0) > 1,
        planos: listaPlanos.length > 0,
      }}
    />
  )
}
