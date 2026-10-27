import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarPtax } from './cambio'
import { simularQuitacao } from './dividas'
import { historicoPatrimonio } from './familia'
import {
  CATEGORIAS_DESPESA, TIPOS_CONTA, TIPOS_DIVIDA, comAportado, competenciaISO, despesaMensal, espelharLancamento, lancamentoEssencial, planoPrincipal, projetarPlano, rendaMensal,
  type Cartao, type Despesa, type Lancamento, type Plano, type Renda,
} from './financas'
import { diagnosticar, type Alerta } from './financas-diagnostico'
import { carregarPatrimonio } from './patrimonio'

/** Tudo o que a apresentação da família precisa, já calculado e serializável. */
export interface Retrato {
  familiaNome: string
  competencia: string
  hoje: string
  diasRestantes: number // incluindo hoje
  mes: {
    gasto: number
    planejado: number
    restante: number
    porDia: number | null
    naoEssencial: number
    gastoMesAnterior: number | null
    categorias: { cat: string; label: string; valor: number }[]
  }
  patrimonio: {
    liquido: number
    ativos: number
    passivos: number
    variacao: number | null
    historico: { mes: string; valor: number }[]
    tenho: { nome: string; tipo: string; valor: number }[] // contas, investimentos e o dólar
  } | null
  // Cada dívida com o que falta: as cadastradas em Patrimônio e as parcelas do Orçamento
  devo: {
    nome: string
    saldo: number
    parcela: number
    meses: number | null // meses que faltam (null = no ritmo atual não acaba)
    fim: string | null   // mês da última parcela
    detalhe: string      // "SAC · 0,888% a.m.", "parcelas do Orçamento", ...
  }[]
  semSaldo: string[] // financiamentos sem saldo devedor informado
  planos: {
    id: string
    titulo: string
    progresso: number
    guardado: number
    meta: number
    falta: number
    previsao: string | null
    aporte: number
    metaDefinida: boolean
    ativo: boolean
    principal: boolean
  }[]
  dividas: {
    total: number
    livreEm: string | null
    meses: number | null
    primeira: { nome: string; juros: number } | null
  } | null
  plano: {
    id: string
    titulo: string
    progresso: number
    falta: number
    previsao: string | null
    aporte: number
    metaDefinida: boolean
  } | null
  foco: Alerta | null
  carta: string | null
  // Para o lançamento rápido
  cartoes: Cartao[]
  renda: number
  planoPrincipal: Plano | null
  setup: { rendas: boolean; fixos: boolean; cartoes: boolean; familia: boolean; planos: boolean }
}

export async function carregarRetrato(supabase: SupabaseClient, familiaId: string): Promise<Retrato> {
  const agora = new Date()
  const competencia = competenciaISO(agora)
  const mesAnterior = competenciaISO(new Date(agora.getFullYear(), agora.getMonth() - 1, 1))
  const ptaxPromise = buscarPtax()

  const [
    ptax, { data: familia }, { data: despesas }, { data: rendas }, { data: planos }, { data: lancamentos },
    { data: lancAnterior }, patrimonio, { data: cartoes }, { data: membros }, { data: carta }, { data: aportes },
  ] = await Promise.all([
    ptaxPromise,
    supabase.from('fin_familias').select('nome, tetos').eq('id', familiaId).single(),
    supabase.from('fin_despesas').select('*').eq('familia_id', familiaId),
    supabase.from('fin_rendas').select('*').eq('familia_id', familiaId),
    supabase.from('fin_planos').select('*').eq('familia_id', familiaId),
    supabase.from('fin_lancamentos').select('valor, categoria, essencial, descricao, despesa_id, competencia, parcela_atual, parcelas_total')
      .eq('familia_id', familiaId).eq('competencia', competencia),
    supabase.from('fin_lancamentos').select('valor').eq('familia_id', familiaId).eq('competencia', mesAnterior),
    carregarPatrimonio(supabase, familiaId, ptaxPromise.then(p => p?.venda ?? null)),
    supabase.from('fin_cartoes').select('*').eq('familia_id', familiaId).order('created_at'),
    supabase.rpc('fin_membros_familia'),
    supabase.from('fin_cartas').select('texto').eq('familia_id', familiaId).eq('mes', competencia).maybeSingle(),
    supabase.from('fin_aportes').select('plano_id, valor, pago').eq('familia_id', familiaId),
  ])

  const listaDespesas = (despesas ?? []) as Despesa[]
  const listaRendas = (rendas ?? []) as Renda[]
  // O que já foi guardado conta os aportes pagos (ou o dólar de Patrimônio, se o plano escolheu assim)
  const listaPlanos = comAportado(((planos ?? []) as Plano[]).map(p =>
    p.moeda === 'USD' && !p.cotacao && ptax ? { ...p, cotacao: ptax.venda } : p
  ), aportes ?? [], patrimonio.usd)
  type LancResumo = Pick<Lancamento, 'valor' | 'categoria' | 'essencial' | 'descricao' | 'despesa_id' | 'competencia' | 'parcela_atual' | 'parcelas_total'>
  const lancs = ((lancamentos ?? []) as LancResumo[]).map(l => espelharLancamento(l, listaDespesas))

  // ── O mês
  const gasto = lancs.reduce((a, l) => a + Number(l.valor), 0)
  const tetos = (familia?.tetos ?? {}) as Record<string, number>
  const totalTetos = Object.values(tetos).reduce((a, v) => a + Number(v), 0)
  const planejado = totalTetos > 0 ? totalTetos : listaDespesas.reduce((a, d) => a + despesaMensal(d), 0)
  const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate()
  const diasRestantes = ultimoDia - agora.getDate() + 1
  const restante = planejado - gasto
  const porCategoria = lancs.reduce<Record<string, number>>((acc, l) => {
    acc[l.categoria] = (acc[l.categoria] ?? 0) + Number(l.valor)
    return acc
  }, {})
  const anterior = (lancAnterior ?? []) as Pick<Lancamento, 'valor'>[]

  // ── O placar
  let patrimonioRetrato: Retrato['patrimonio'] = null
  if (patrimonio.temDados) {
    const fechamentos = await historicoPatrimonio(supabase, familiaId, patrimonio.ativos, patrimonio.passivos)
    const historico = fechamentos
      .map(f => ({ mes: f.mes, valor: Number(f.ativos) - Number(f.dividas) }))
    const penultimo = historico.length >= 2 ? historico[historico.length - 2] : null
    patrimonioRetrato = {
      liquido: patrimonio.liquido,
      ativos: patrimonio.ativos,
      passivos: patrimonio.passivos,
      variacao: penultimo ? patrimonio.liquido - penultimo.valor : null,
      historico,
      tenho: [
        ...patrimonio.contas.map(c => ({ nome: c.nome, tipo: TIPOS_CONTA[c.tipo] ?? c.tipo, valor: Number(c.saldo) })),
        ...(patrimonio.usd > 0 ? [{ nome: `Dólar guardado (US$ ${patrimonio.usd.toLocaleString('pt-BR', { maximumFractionDigits: 2 })})`, tipo: 'Dólar', valor: patrimonio.dolarBRL }] : []),
      ].sort((a, b) => b.valor - a.valor),
    }
  }

  // ── O que devo, item a item, com os meses que faltam
  const mesesDepois = (n: number) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() + n - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }
  const devo: Retrato['devo'] = [
    ...patrimonio.dividas.filter(d => Number(d.saldo) > 0).map(d => {
      const meses = d.amortizacao === 'sac' && d.prazo_meses ? d.prazo_meses : simularQuitacao([d], 0, 'avalanche', agora).meses
      const juros = Number(d.juros_mensal) > 0 ? ` · ${String(d.juros_mensal).replace('.', ',')}% a.m.` : ''
      return {
        nome: d.nome, saldo: Number(d.saldo), parcela: Number(d.parcela), meses, fim: meses ? mesesDepois(meses) : null,
        detalhe: `${d.amortizacao === 'sac' ? 'SAC' : TIPOS_DIVIDA[d.tipo] ?? 'Dívida'}${juros}`,
      }
    }),
    ...patrimonio.parcelas.map(p => ({
      nome: p.descricao, saldo: p.total, parcela: p.parcela, meses: p.restantes, fim: p.fim,
      detalhe: p.noCartao ? 'parcelado no cartão' : 'parcelado',
    })),
  ].sort((a, b) => b.saldo - a.saldo)

  // ── As dívidas
  const diag = diagnosticar(listaDespesas, listaRendas)
  let dividas: Retrato['dividas'] = null
  if (patrimonio.passivos > 0) {
    const sim = simularQuitacao(patrimonio.dividas, Math.max(diag.saldo, 0), 'avalanche', agora)
    dividas = {
      total: patrimonio.passivos,
      livreEm: sim.dataLivre?.toISOString() ?? null,
      meses: sim.meses,
      primeira: sim.ordem[0] ? { nome: sim.ordem[0].nome, juros: Number(sim.ordem[0].juros_mensal) } : null,
    }
  }

  // ── O sonho
  const principal = planoPrincipal(listaPlanos)
  const pr = principal ? projetarPlano(principal) : null

  return {
    familiaNome: (familia?.nome as string | undefined) ?? 'Minhas finanças',
    competencia,
    hoje: agora.toISOString(),
    diasRestantes,
    mes: {
      gasto,
      planejado,
      restante,
      porDia: planejado > 0 && restante > 0 ? restante / diasRestantes : null,
      naoEssencial: lancs.filter(l => !lancamentoEssencial(l)).reduce((a, l) => a + Number(l.valor), 0),
      gastoMesAnterior: anterior.length ? anterior.reduce((a, l) => a + Number(l.valor), 0) : null,
      categorias: Object.entries(porCategoria)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, valor]) => ({ cat, label: CATEGORIAS_DESPESA[cat]?.label ?? cat, valor })),
    },
    patrimonio: patrimonioRetrato,
    dividas,
    devo,
    semSaldo: patrimonio.semSaldo.map(s => s.descricao),
    planos: listaPlanos
      .filter(p => p.status !== 'concluido')
      .map(p => {
        const proj = projetarPlano(p)
        return {
          id: p.id, titulo: p.titulo, progresso: proj.progresso, guardado: proj.guardadoBRL, meta: proj.metaBRL, falta: proj.faltaBRL,
          previsao: proj.dataPrevista?.toISOString() ?? null, aporte: Number(p.aporte_mensal), metaDefinida: proj.metaBRL > 0,
          ativo: p.status === 'ativo', principal: principal?.id === p.id,
        }
      })
      .sort((a, b) => Number(b.principal) - Number(a.principal) || Number(b.ativo) - Number(a.ativo) || b.progresso - a.progresso),
    plano: principal && pr ? {
      id: principal.id,
      titulo: principal.titulo,
      progresso: pr.progresso,
      falta: pr.faltaBRL,
      previsao: pr.dataPrevista?.toISOString() ?? null,
      aporte: Number(principal.aporte_mensal),
      metaDefinida: pr.metaBRL > 0,
    } : null,
    foco: diag.alertas.find(a => a.nivel === 'critico' || a.nivel === 'atencao') ?? diag.alertas[0] ?? null,
    carta: (carta?.texto as string | undefined) ?? null,
    cartoes: (cartoes ?? []) as Cartao[],
    renda: listaRendas.reduce((a, r) => a + rendaMensal(r), 0),
    planoPrincipal: principal,
    setup: {
      rendas: listaRendas.length > 0,
      fixos: listaDespesas.length > 0,
      cartoes: (cartoes?.length ?? 0) > 0,
      familia: (membros?.length ?? 0) > 1,
      planos: listaPlanos.length > 0,
    },
  }
}
