import {
  diaNoMes, dizimoDoMes, faturaPagaNoMes, rendaDoMes, somarMeses, vencimentoFatura,
  type Cartao, type Despesa, type DizimoDevolvido, type FaturaPaga, type Lancamento, type Renda,
} from './financas'

/** Uma saída de dinheiro no mês: conta fora do cartão, fatura de cartão ou fixo do orçamento ainda não lançado. */
export interface Saida {
  chave: string
  tipo: 'conta' | 'fatura' | 'previsto' | 'dizimo'
  descricao: string
  valor: number
  data: string | null // quando sai (YYYY-MM-DD); null = sem dia definido
  pago: boolean
  categoria?: string
  atrasada?: boolean // ficou pendente de um mês anterior
  lancamento?: Lancamento
  despesa?: Despesa
  cartao?: Cartao
  competenciaFatura?: string
  previstoNaFatura?: number // fixos e parcelas do cartão que ainda não chegaram à fatura
  competenciaDizimo?: string
  renda?: number // base do dízimo
  dizimo?: DizimoDevolvido // quando já devolvido
}

interface Entrada {
  mes: string // YYYY-MM-01
  lancamentos: Lancamento[] // do mês
  atrasados: Lancamento[] // fora do cartão, pendentes de meses anteriores
  cartoes: Cartao[]
  faturasPagas: FaturaPaga[]
  faturaAnterior: Pick<Lancamento, 'cartao_id' | 'valor'>[] // linhas de cartão do mês anterior
  fixosPendentes: Despesa[] // do orçamento, ainda não lançados no mês
  rendas: Renda[]
  dizimos: DizimoDevolvido[] // devolvidos desde dizimoDesde
  dizimoDesde: string | null // primeiro mês em que o dízimo é acompanhado
  verAtrasos: boolean // mês atual: traz o que ficou em aberto de meses anteriores
}

export const dataPagamento = (l: Pick<Lancamento, 'vencimento' | 'data'>) => l.vencimento ?? l.data

/** Tudo o que sai da conta no mês, pela data em que sai. */
export function montarSaidas({
  mes, lancamentos, atrasados, cartoes, faturasPagas, faturaAnterior, fixosPendentes, rendas, dizimos, dizimoDesde, verAtrasos,
}: Entrada): Saida[] {
  const pagas = new Set(faturasPagas.map(f => `${f.cartao_id}|${f.competencia.slice(0, 10)}`))
  const conta = (l: Lancamento, atrasada = false): Saida => ({
    chave: `l-${l.id}`, tipo: 'conta', descricao: l.descricao, valor: Number(l.valor), data: dataPagamento(l),
    pago: l.pago, categoria: l.categoria, atrasada, lancamento: l,
  })

  const saidas: Saida[] = [
    ...atrasados.map(l => conta(l, true)),
    ...lancamentos.filter(l => !l.cartao_id).map(l => conta(l)),
    ...fixosPendentes.filter(d => !d.cartao_id).map((d): Saida => ({
      chave: `d-${d.id}`, tipo: 'previsto', descricao: d.descricao, valor: Number(d.valor),
      data: d.dia_vencimento ? diaNoMes(mes, d.dia_vencimento) : null, pago: false, categoria: d.categoria, despesa: d,
    })),
  ]

  for (const c of cartoes) {
    const competencia = faturaPagaNoMes(c, mes)
    const doMes = competencia === mes
    const lancado = doMes
      ? lancamentos.filter(l => l.cartao_id === c.id).reduce((a, l) => a + Number(l.valor), 0)
      : faturaAnterior.filter(l => l.cartao_id === c.id).reduce((a, l) => a + Number(l.valor), 0)
    const previsto = doMes ? fixosPendentes.filter(d => d.cartao_id === c.id).reduce((a, d) => a + Number(d.valor), 0) : 0
    if (lancado + previsto === 0) continue
    saidas.push({
      chave: `f-${c.id}`, tipo: 'fatura', descricao: `Fatura ${c.nome}`, valor: lancado + previsto,
      data: vencimentoFatura(c, competencia), pago: pagas.has(`${c.id}|${competencia}`),
      cartao: c, competenciaFatura: competencia, previstoNaFatura: previsto,
    })
  }

  saidas.sort((a, b) => (a.data ?? '9999').localeCompare(b.data ?? '9999') || b.valor - a.valor)
  // O dízimo vem primeiro: as primícias
  return [...montarDizimos(mes, rendas, dizimos, dizimoDesde, verAtrasos), ...saidas]
}

/** Dízimo do mês e, no mês atual, os meses anteriores ainda não devolvidos. */
export function montarDizimos(
  mes: string, rendas: Renda[], dizimos: DizimoDevolvido[], dizimoDesde: string | null, verAtrasos: boolean,
): Saida[] {
  if (!dizimoDesde || mes < dizimoDesde.slice(0, 10)) return []
  const devolvidos = new Map(dizimos.map(d => [d.competencia.slice(0, 10), d]))
  const meses: string[] = []
  for (let c = verAtrasos ? dizimoDesde.slice(0, 10) : mes; c <= mes; c = somarMeses(c, 1)) meses.push(c)

  return meses.flatMap((c): Saida[] => {
    const dizimo = devolvidos.get(c)
    const devido = dizimoDoMes(rendas, c)
    if (c < mes && dizimo) return [] // mês anterior já devolvido
    if (!dizimo && devido <= 0) return []
    return [{
      chave: `z-${c}`, tipo: 'dizimo', descricao: 'Dízimo', valor: dizimo ? Number(dizimo.valor) : devido,
      data: dizimo?.devolvido_em ?? null, pago: !!dizimo, atrasada: c < mes,
      competenciaDizimo: c, renda: rendaDoMes(rendas, c), dizimo,
    }]
  })
}

