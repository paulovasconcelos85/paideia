// Cotação do dólar pela PTAX do Banco Central (API Olinda, dados abertos, sem chave)
// https://dadosabertos.bcb.gov.br/dataset/dolar-americano-usd-todos-os-boletins-diarios

export interface Ptax {
  venda: number
  compra: number
  data: string // AAAA-MM-DD do último boletim de fechamento
  serie: { data: string; venda: number }[] // últimos ~30 dias úteis
}

const BASE = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata'

// A API espera datas no formato MM-DD-AAAA
function formatoBcb(d: Date) {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`
}

/** PTAX de fechamento mais recente e a série dos últimos 45 dias. Retorna null se o BC estiver fora do ar. */
export async function buscarPtax(): Promise<Ptax | null> {
  const fim = new Date()
  const inicio = new Date(fim.getTime() - 45 * 86400000)
  const url =
    `${BASE}/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
    `?@dataInicial='${formatoBcb(inicio)}'&@dataFinalCotacao='${formatoBcb(fim)}'` +
    `&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao&$orderby=dataHoraCotacao&$format=json`

  try {
    // A PTAX sai uma vez por dia útil (~13h): uma hora de cache basta
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const json = await res.json() as { value?: { cotacaoCompra: number; cotacaoVenda: number; dataHoraCotacao: string }[] }
    const valores = json.value ?? []
    if (valores.length === 0) return null
    const ultimo = valores[valores.length - 1]
    return {
      venda: ultimo.cotacaoVenda,
      compra: ultimo.cotacaoCompra,
      data: ultimo.dataHoraCotacao.slice(0, 10),
      serie: valores.map(v => ({ data: v.dataHoraCotacao.slice(0, 10), venda: v.cotacaoVenda })),
    }
  } catch {
    return null
  }
}

export function formatCotacao(v: number) {
  return `R$ ${v.toFixed(4).replace('.', ',')}`
}
