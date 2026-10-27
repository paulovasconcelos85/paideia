import type { SupabaseClient } from '@supabase/supabase-js'
import type { Conta, Divida } from './financas'

export interface CompraDolar {
  id: string
  data: string
  valor_usd: number
  valor_brl: number
  observacao: string | null
}

export interface Patrimonio {
  contas: Conta[]
  dividas: Divida[]
  compras: CompraDolar[]
  usd: number            // dólares guardados
  precoMedio: number | null
  dolarBRL: number       // dólares a valor de PTAX (ou ao preço médio, se o BC estiver fora)
  ativos: number         // contas + dólar
  passivos: number
  liquido: number
  temDados: boolean
}

/** Tudo o que a família tem e deve, com o dólar avaliado pela PTAX do dia. */
export async function carregarPatrimonio(
  supabase: SupabaseClient, familiaId: string, cotacao: number | null | Promise<number | null>,
): Promise<Patrimonio> {
  // A cotação pode chegar como promessa, para a PTAX vir em paralelo com as consultas
  const [{ data: contas }, { data: dividas }, { data: compras }, ptaxVenda] = await Promise.all([
    supabase.from('fin_contas').select('*').eq('familia_id', familiaId).order('saldo', { ascending: false }),
    supabase.from('fin_dividas').select('*').eq('familia_id', familiaId).order('saldo', { ascending: false }),
    supabase.from('fin_compras_dolar').select('*').eq('familia_id', familiaId).order('data', { ascending: false }),
    cotacao,
  ])

  const listaContas = (contas ?? []) as Conta[]
  const listaDividas = (dividas ?? []) as Divida[]
  const listaCompras = (compras ?? []) as CompraDolar[]

  const usd = listaCompras.reduce((a, c) => a + Number(c.valor_usd), 0)
  const pagoBRL = listaCompras.reduce((a, c) => a + Number(c.valor_brl), 0)
  const precoMedio = usd > 0 ? pagoBRL / usd : null
  const dolarBRL = usd * (ptaxVenda ?? precoMedio ?? 0)
  const ativos = listaContas.reduce((a, c) => a + Number(c.saldo), 0) + dolarBRL
  const passivos = listaDividas.reduce((a, d) => a + Number(d.saldo), 0)

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
    temDados: listaContas.length + listaDividas.length + listaCompras.length > 0,
  }
}
