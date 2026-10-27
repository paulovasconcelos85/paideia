import type { Divida } from './financas'

export type Estrategia = 'avalanche' | 'bola_de_neve'

export interface ResultadoQuitacao {
  ordem: Divida[]
  meses: number | null // null = com esse orçamento a dívida nunca acaba
  jurosTotal: number
  dataLivre: Date | null
}

const LIMITE_MESES = 600

/**
 * Simula a quitação mês a mês: todas pagam a parcela mínima e o dinheiro extra
 * (mais as parcelas das dívidas já quitadas) vai para a primeira da fila.
 * Avalanche = maiores juros primeiro (paga menos juros). Bola de neve = menor saldo primeiro (vitórias rápidas).
 */
export function simularQuitacao(dividas: Divida[], extraMensal: number, estrategia: Estrategia, hoje = new Date()): ResultadoQuitacao {
  const ordem = [...dividas]
    .filter(d => Number(d.saldo) > 0)
    .sort((a, b) =>
      estrategia === 'avalanche'
        ? Number(b.juros_mensal) - Number(a.juros_mensal) || Number(a.saldo) - Number(b.saldo)
        : Number(a.saldo) - Number(b.saldo) || Number(b.juros_mensal) - Number(a.juros_mensal)
    )

  if (ordem.length === 0) return { ordem, meses: 0, jurosTotal: 0, dataLivre: hoje }

  const saldos = ordem.map(d => Number(d.saldo))
  // SAC: o mínimo do mês é juros + amortização fixa (saldo ÷ prazo), e cai com o tempo. Seguros ficam de fora.
  const amortSac = ordem.map(d => (d.amortizacao === 'sac' && d.prazo_meses ? Number(d.saldo) / d.prazo_meses : null))
  // As de parcela fixa formam um orçamento fixo: quando uma acaba, a parcela dela vai para a próxima da fila
  const orcamentoFixo = ordem.reduce((a, d, i) => a + (amortSac[i] === null ? Number(d.parcela) : 0), 0) + Math.max(extraMensal, 0)
  let jurosTotal = 0

  for (let mes = 1; mes <= LIMITE_MESES; mes++) {
    const minimo = ordem.map((d, i) => {
      if (saldos[i] <= 0) return 0
      const juros = saldos[i] * (Number(d.juros_mensal) / 100)
      saldos[i] += juros
      jurosTotal += juros
      return amortSac[i] === null ? Number(d.parcela) : juros + amortSac[i]!
    })

    let disponivel = orcamentoFixo + ordem.reduce((a, _, i) => a + (amortSac[i] === null ? 0 : minimo[i]), 0)
    ordem.forEach((_, i) => {
      const pago = Math.min(saldos[i], minimo[i], disponivel)
      saldos[i] -= pago
      disponivel -= pago
    })
    for (let i = 0; i < saldos.length && disponivel > 0; i++) {
      const pago = Math.min(saldos[i], disponivel)
      saldos[i] -= pago
      disponivel -= pago
    }

    if (saldos.every(s => s < 0.01)) {
      return { ordem, meses: mes, jurosTotal, dataLivre: new Date(hoje.getFullYear(), hoje.getMonth() + mes, 1) }
    }
  }

  return { ordem, meses: null, jurosTotal, dataLivre: null }
}
