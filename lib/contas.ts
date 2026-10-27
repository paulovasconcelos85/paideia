import {
  dataNaCompetencia, diaNoMes, dizimoDoMes, faturaPagaNoMes, ocorreNoMes, rendaDoMes, rotuloParcela, somarMeses, vencimentoFatura,
  type Aporte, type Cartao, type Despesa, type DizimoDevolvido, type FaturaPaga, type Lancamento, type Plano, type Receita, type Renda,
} from './financas'

/**
 * Uma linha da planilha do mês: tudo o que sai da conta, com vencimento, valor e se já foi pago.
 * - conta: fora do cartão. Com `lancamento`, já registrada no mês; sem ele, vem do cadastro (`despesa`) com o valor padrão.
 * - fatura: total do cartão que vence no mês, com as linhas dentro.
 * - dizimo: 10% da renda do mês (não é gasto: é devolução).
 */
export interface Conta {
  chave: string
  tipo: 'conta' | 'fatura' | 'dizimo' | 'aporte'
  descricao: string
  valor: number
  vencimento: string | null // YYYY-MM-DD
  pago: boolean
  categoria?: string
  parcela?: string | null // "2/5", "faltam 3", "última"
  atrasada?: boolean // ficou em aberto de um mês anterior
  lancamento?: Lancamento
  despesa?: Despesa
  cartao?: Cartao
  competenciaFatura?: string
  linhas?: Lancamento[]
  previstoNaFatura?: number
  previstos?: { descricao: string; valor: number; parcela: string | null }[] // fixos e parcelas do cartão ainda não lançados
  competenciaDizimo?: string
  renda?: number
  dizimo?: DizimoDevolvido
  plano?: Plano
  aporte?: Aporte
}

interface Entrada {
  mes: string // YYYY-MM-01
  lancamentos: Lancamento[] // do mês
  atrasados: Lancamento[] // fora do cartão, a pagar, de meses anteriores
  cartoes: Cartao[]
  despesas: Despesa[]
  faturasPagas: FaturaPaga[]
  faturaAnterior: Lancamento[] // linhas de cartão do mês anterior (faturas que vencem neste mês)
  rendas: Renda[]
  receitas?: Receita[] // o que entrou de fato (manda sobre a previsão)
  dizimos: DizimoDevolvido[]
  dizimoDesde: string | null
  verAtrasos: boolean // mês atual: traz o que ficou em aberto antes
  planos?: Plano[] // os aportes dos planos ativos entram como contas
  aportes?: Aporte[]
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const vencimentoDe =(l: Pick<Lancamento, 'vencimento' | 'data'>) => l.vencimento ?? l.data

export function montarContas(e: Entrada): Conta[] {
  const { mes, lancamentos, atrasados, cartoes, despesas } = e
  const despesaDe = (l: Lancamento) => (l.despesa_id ? despesas.find(d => d.id === l.despesa_id) : undefined)

  const registrada = (l: Lancamento, atrasada = false): Conta => {
    const d = despesaDe(l)
    return {
      chave: `l-${l.id}`, tipo: 'conta', descricao: l.descricao, valor: Number(l.valor), vencimento: vencimentoDe(l),
      pago: l.pago, categoria: l.categoria, atrasada, lancamento: l, despesa: d,
      parcela: d ? rotuloParcela(d, l.competencia) : l.parcelas_total ? `${l.parcela_atual}/${l.parcelas_total}` : null,
    }
  }

  // Cadastradas que ainda não têm registro no mês: entram com o valor e o dia padrão
  const registradasNoMes = new Set(lancamentos.map(l => l.despesa_id).filter(Boolean))
  const doCadastro = despesas
    .filter(d => !d.cartao_id && !registradasNoMes.has(d.id) && ocorreNoMes(d, mes))
    .map((d): Conta => ({
      chave: `d-${d.id}`, tipo: 'conta', descricao: d.descricao, valor: Number(d.valor),
      vencimento: d.dia_vencimento ? diaNoMes(mes, d.dia_vencimento) : null, pago: false,
      categoria: d.categoria, despesa: d, parcela: rotuloParcela(d, mes),
    }))

  const contas: Conta[] = [
    ...atrasados.map(l => registrada(l, true)),
    ...lancamentos.filter(l => !l.cartao_id).map(l => registrada(l)),
    ...doCadastro,
    ...montarFaturas(e),
    ...montarAportes(e),
  ].sort((a, b) => (a.vencimento ?? '9999').localeCompare(b.vencimento ?? '9999') || b.valor - a.valor)

  return [...montarDizimos(e), ...contas]
}

function montarFaturas({ mes, lancamentos, cartoes, despesas, faturasPagas, faturaAnterior }: Entrada): Conta[] {
  const pagas = new Set(faturasPagas.map(f => `${f.cartao_id}|${f.competencia.slice(0, 10)}`))
  return cartoes.flatMap((c): Conta[] => {
    const competencia = faturaPagaNoMes(c, mes)
    const doMes = competencia === mes
    const linhas = (doMes ? lancamentos : faturaAnterior).filter(l => l.cartao_id === c.id)
    const lancadas = new Set(linhas.map(l => l.despesa_id).filter(Boolean))
    // A importação só liga parcelas ao Orçamento: um fixo (ex.: Spotify) chega solto. Conta como lançado
    // quando há uma compra sem ligação com o mesmo nome e valor próximo, para não somar duas vezes.
    const soltas = linhas.filter(l => !l.despesa_id)
    for (const d of despesas.filter(x => x.cartao_id === c.id && !lancadas.has(x.id))) {
      const chave = normalizar(d.descricao).split(/[^a-z0-9]+/).find(p => p.length >= 4)
      const achou = chave && soltas.some(l =>
        normalizar(l.descricao).replace(/[^a-z0-9]/g, '').includes(chave) &&
        Math.abs(Number(l.valor) - Number(d.valor)) <= Number(d.valor) * 0.1)
      if (achou) lancadas.add(d.id)
    }
    // A fatura parte dos fixos e parcelas do cartão (Orçamento) que ainda não foram lançados nela,
    // inclusive quando vence no mês seguinte ao fechamento; o que for lançado substitui o previsto
    const previstos = despesas
      .filter(d => d.cartao_id === c.id && !lancadas.has(d.id) && ocorreNoMes(d, competencia))
      .map(d => ({ descricao: d.descricao, valor: Number(d.valor), parcela: rotuloParcela(d, competencia) }))
    const previsto = previstos.reduce((a, d) => a + d.valor, 0)
    const total = linhas.reduce((a, l) => a + Number(l.valor), 0) + previsto
    if (total === 0) return []
    return [{
      chave: `f-${c.id}`, tipo: 'fatura', descricao: `Fatura ${c.nome}`, valor: total,
      vencimento: vencimentoFatura(c, competencia), pago: pagas.has(`${c.id}|${competencia}`),
      cartao: c, competenciaFatura: competencia, linhas, previstoNaFatura: previsto, previstos,
    }]
  })
}

/** "Guardar para ...": o aporte mensal de cada plano ativo, a partir do mês em que o plano foi criado. */
function montarAportes({ mes, planos = [], aportes = [] }: Entrada): Conta[] {
  return planos.flatMap((p): Conta[] => {
    const registro = aportes.find(a => a.plano_id === p.id && a.competencia.slice(0, 10) === mes)
    const previsto = p.status === 'ativo' && Number(p.aporte_mensal) > 0 && p.created_at.slice(0, 7) <= mes.slice(0, 7)
    if (!registro && !previsto) return []
    return [{
      chave: `a-${p.id}`, tipo: 'aporte', descricao: `Guardar: ${p.titulo}`,
      valor: registro ? Number(registro.valor) : Number(p.aporte_mensal),
      vencimento: dataNaCompetencia(mes, p.dia_aporte ?? 27), pago: registro?.pago ?? false,
      plano: p, aporte: registro,
    }]
  })
}

/** Dízimo do mês e, no mês atual, os meses anteriores ainda não devolvidos. */
function montarDizimos({ mes, rendas, receitas = [], dizimos, dizimoDesde, verAtrasos }: Entrada): Conta[] {
  if (!dizimoDesde || mes < dizimoDesde.slice(0, 10)) return []
  const devolvidos = new Map(dizimos.map(d => [d.competencia.slice(0, 10), d]))
  const meses: string[] = []
  for (let c = verAtrasos ? dizimoDesde.slice(0, 10) : mes; c <= mes; c = somarMeses(c, 1)) meses.push(c)

  return meses.flatMap((c): Conta[] => {
    const dizimo = devolvidos.get(c)
    const devido = dizimoDoMes(rendas, c, receitas)
    if (c < mes && dizimo) return []
    if (!dizimo && devido <= 0) return []
    return [{
      chave: `z-${c}`, tipo: 'dizimo', descricao: 'Dízimo', valor: dizimo ? Number(dizimo.valor) : devido,
      vencimento: dizimo?.devolvido_em ?? null, pago: !!dizimo, atrasada: c < mes,
      competenciaDizimo: c, renda: rendaDoMes(rendas, c, receitas), dizimo,
    }]
  })
}
