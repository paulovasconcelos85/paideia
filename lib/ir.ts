// Estimativa simplificada do IRPF anual (declaração completa × simplificada).
// Valores de referência: tabela mensal vigente desde maio/2025 ×12, limites de dedução de 2025
// e o redutor da Lei 15.270/2025 (isenção até R$ 5 mil/mês a partir de 2026).
// Confira e atualize todo ano: a Receita muda esses números.

const FAIXAS = [
  { ate: 29145.6, aliquota: 0, deducao: 0 },
  { ate: 33919.8, aliquota: 0.075, deducao: 2185.92 },
  { ate: 45012.6, aliquota: 0.15, deducao: 4729.92 },
  { ate: 55976.16, aliquota: 0.225, deducao: 8105.88 },
  { ate: Infinity, aliquota: 0.275, deducao: 10904.76 },
]

export const LIMITES_IR = {
  educacaoPorPessoa: 3561.5,
  porDependente: 2275.08,
  descontoSimplificado: 16754.34,
  pgblPercentual: 0.12,
}

export interface EntradaIR {
  brutoMensal: number          // salário bruto tributável
  previdenciaMensal: number    // INSS ou previdência do servidor (RPPS)
  dependentes: number
  saudeAnual: number           // sem limite na declaração completa
  educacaoAnual: number        // total da família (titular + dependentes)
  pgblAnual: number            // PGBL atual
}

export interface ResultadoIR {
  rendaTributavel: number
  irCompleto: number
  irSimplificado: number
  melhor: 'completo' | 'simplificado'
  economiaModelo: number       // diferença entre os dois modelos
  pgblMaximo: number
  economiaPgbl: number         // quanto o IR cai ao aportar até 12% em PGBL
  aliquotaMarginal: number
}

function impostoTabela(base: number) {
  const faixa = FAIXAS.find(f => base <= f.ate)!
  return { imposto: Math.max(base * faixa.aliquota - faixa.deducao, 0), aliquota: faixa.aliquota }
}

// Redutor anual da Lei 15.270/2025: zera o imposto até R$ 60 mil/ano e reduz gradualmente até R$ 88,2 mil
function redutor(rendaTributavel: number, imposto: number) {
  if (rendaTributavel <= 60000) return Math.min(imposto, 2694.15)
  if (rendaTributavel <= 88200) return Math.min(imposto, Math.max(8429.73 - 0.095575 * rendaTributavel, 0))
  return 0
}

function irComDeducoes(rendaTributavel: number, deducoes: number) {
  const { imposto, aliquota } = impostoTabela(Math.max(rendaTributavel - deducoes, 0))
  return { ir: imposto - redutor(rendaTributavel, imposto), aliquota }
}

export function simularIR(e: EntradaIR): ResultadoIR {
  // 13º tem tributação exclusiva (fica fora); o terço de férias entra na base anual
  const rendaTributavel = e.brutoMensal * 12 + e.brutoMensal / 3
  const pgblMaximo = rendaTributavel * LIMITES_IR.pgblPercentual

  const deducoesCompleto = (pgbl: number) =>
    e.previdenciaMensal * 12 +
    e.saudeAnual +
    Math.min(e.educacaoAnual, LIMITES_IR.educacaoPorPessoa * (1 + e.dependentes)) +
    e.dependentes * LIMITES_IR.porDependente +
    Math.min(pgbl, pgblMaximo)

  const completo = irComDeducoes(rendaTributavel, deducoesCompleto(e.pgblAnual))
  const simplificado = irComDeducoes(rendaTributavel, Math.min(rendaTributavel * 0.2, LIMITES_IR.descontoSimplificado))
  const completoPgblMax = irComDeducoes(rendaTributavel, deducoesCompleto(pgblMaximo))

  const melhorAtual = Math.min(completo.ir, simplificado.ir)
  return {
    rendaTributavel,
    irCompleto: completo.ir,
    irSimplificado: simplificado.ir,
    melhor: completo.ir <= simplificado.ir ? 'completo' : 'simplificado',
    economiaModelo: Math.abs(completo.ir - simplificado.ir),
    pgblMaximo,
    economiaPgbl: Math.max(melhorAtual - completoPgblMax.ir, 0),
    aliquotaMarginal: completo.aliquota,
  }
}
