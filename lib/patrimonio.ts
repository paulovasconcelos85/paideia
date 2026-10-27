import type { SupabaseClient } from '@supabase/supabase-js'
import { fimParcelas, parcelasRestantes, valorRestante, type Conta, type Despesa, type Divida } from './financas'

export interface CompraDolar {
  id: string
  data: string
  valor_usd: number
  valor_brl: number
  observacao: string | null
}

/** Compra parcelada do Orçamento: o que falta pagar dela é dívida. */
export interface ParcelaDevida {
  id: string
  descricao: string
  parcela: number
  restantes: number
  total: number
  noCartao: boolean
  fim: string | null // YYYY-MM-01 da última parcela
}

/** Conta fixa que é dívida (financiamento, empréstimo) mas não tem saldo devedor informado. */
export interface DividaSemSaldo {
  id: string
  descricao: string
  valor: number
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const PARECE_DIVIDA = /financiamento|emprestimo|consorcio|consignado/

/**
 * O que o Orçamento já diz que eu devo: o restante das compras parceladas e os financiamentos sem fim cadastrado.
 * Quando já existe uma dívida cadastrada com o mesmo nome, ela manda (não conta duas vezes).
 */
export function dividasDoOrcamento(despesas: Despesa[], dividas: Pick<Divida, 'nome'>[], hoje = new Date()) {
  const nomes = dividas.map(d => normalizar(d.nome))
  const jaCadastrada = (descricao: string) => {
    const n = normalizar(descricao)
    return nomes.some(x => x === n || x.includes(n) || n.includes(x))
  }
  const parcelas: ParcelaDevida[] = despesas
    .filter(d => d.ativo && d.frequencia === 'parcelada' && !jaCadastrada(d.descricao))
    .map(d => {
      const fim = fimParcelas(d, hoje)
      return {
        id: d.id, descricao: d.descricao, parcela: Number(d.valor), restantes: parcelasRestantes(d, hoje) ?? 0,
        total: valorRestante(d, hoje), noCartao: !!d.cartao_id,
        fim: fim ? `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}-01` : null,
      }
    })
    .filter(p => p.total > 0)
    .sort((a, b) => b.total - a.total)
  const semSaldo: DividaSemSaldo[] = despesas
    .filter(d => d.ativo && d.frequencia === 'mensal' && (d.categoria === 'dividas' || PARECE_DIVIDA.test(normalizar(d.descricao))) && !jaCadastrada(d.descricao))
    .map(d => ({ id: d.id, descricao: d.descricao, valor: Number(d.valor) }))
  return { parcelas, semSaldo, totalParcelas: parcelas.reduce((a, p) => a + p.total, 0) }
}

export interface Patrimonio {
  contas: Conta[]
  dividas: Divida[]
  compras: CompraDolar[]
  usd: number            // dólares guardados
  precoMedio: number | null
  dolarBRL: number       // dólares a valor de PTAX (ou ao preço médio, se o BC estiver fora)
  ativos: number         // contas + dólar
  passivos: number       // dívidas cadastradas + parcelas que faltam do Orçamento
  liquido: number
  temDados: boolean
  parcelas: ParcelaDevida[]
  semSaldo: DividaSemSaldo[]
}

/** Tudo o que a família tem e deve, com o dólar avaliado pela PTAX do dia. */
export async function carregarPatrimonio(
  supabase: SupabaseClient, familiaId: string, cotacao: number | null | Promise<number | null>,
): Promise<Patrimonio> {
  // A cotação pode chegar como promessa, para a PTAX vir em paralelo com as consultas
  const [{ data: contas }, { data: dividas }, { data: compras }, ptaxVenda, { data: despesas }] = await Promise.all([
    supabase.from('fin_contas').select('*').eq('familia_id', familiaId).order('saldo', { ascending: false }),
    supabase.from('fin_dividas').select('*').eq('familia_id', familiaId).order('saldo', { ascending: false }),
    supabase.from('fin_compras_dolar').select('*').eq('familia_id', familiaId).order('data', { ascending: false }),
    cotacao,
    supabase.from('fin_despesas').select('*').eq('familia_id', familiaId).eq('ativo', true),
  ])

  const listaContas = (contas ?? []) as Conta[]
  const listaDividas = (dividas ?? []) as Divida[]
  const listaCompras = (compras ?? []) as CompraDolar[]

  const usd = listaCompras.reduce((a, c) => a + Number(c.valor_usd), 0)
  const pagoBRL = listaCompras.reduce((a, c) => a + Number(c.valor_brl), 0)
  const precoMedio = usd > 0 ? pagoBRL / usd : null
  const dolarBRL = usd * (ptaxVenda ?? precoMedio ?? 0)
  const ativos = listaContas.reduce((a, c) => a + Number(c.saldo), 0) + dolarBRL
  const doOrcamento = dividasDoOrcamento((despesas ?? []) as Despesa[], listaDividas)
  const passivos = listaDividas.reduce((a, d) => a + Number(d.saldo), 0) + doOrcamento.totalParcelas

  return {
    contas: listaContas,
    dividas: listaDividas,
    compras: listaCompras,
    usd,
    precoMedio,
    dolarBRL,
    ativos,
    passivos,
    liquido: ativos - passivos,
    temDados: listaContas.length + listaDividas.length + listaCompras.length + doOrcamento.parcelas.length > 0,
    parcelas: doOrcamento.parcelas,
    semSaldo: doOrcamento.semSaldo,
  }
}
