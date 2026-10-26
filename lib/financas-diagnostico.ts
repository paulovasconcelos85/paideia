import {
  CATEGORIAS_DESPESA, despesaMensal, formatBRL, rendaMensal,
  type Despesa, type Renda,
} from './financas'

export type NivelAlerta = 'critico' | 'atencao' | 'oportunidade' | 'ok'

export interface Alerta {
  nivel: NivelAlerta
  titulo: string
  texto: string
}

export interface PassoPlano {
  titulo: string
  texto: string
  status: 'feito' | 'atual' | 'futuro'
}

export interface Diagnostico {
  renda: number
  despesa: number
  saldo: number
  taxaPoupanca: number | null
  essenciais: number
  naoEssenciais: number
  dividas: number
  reservaMeta: number
  alertas: Alerta[]
  plano: PassoPlano[]
}

// Referências de mercado para o peso de cada categoria na renda líquida
const TETO_CATEGORIA: Record<string, number> = {
  moradia: 30,
  transporte: 15,
  alimentacao: 20,
  lazer: 10,
  assinaturas: 5,
  pessoal: 5,
}

const ORDEM_NIVEL: Record<NivelAlerta, number> = { critico: 0, atencao: 1, oportunidade: 2, ok: 3 }

const pct = (parte: number, todo: number) => (todo > 0 ? (parte / todo) * 100 : 0)

export function diagnosticar(despesas: Despesa[], rendas: Renda[]): Diagnostico {
  const ativas = despesas.filter(d => despesaMensal(d) > 0)
  const renda = rendas.reduce((a, r) => a + rendaMensal(r), 0)
  const despesa = ativas.reduce((a, d) => a + despesaMensal(d), 0)
  const saldo = renda - despesa
  const taxaPoupanca = renda > 0 ? pct(saldo, renda) : null
  const essenciais = ativas.filter(d => d.essencial).reduce((a, d) => a + despesaMensal(d), 0)
  const naoEssenciais = despesa - essenciais
  // Dívida = categoria "dívidas" + qualquer compra parcelada ainda correndo
  const dividas = ativas
    .filter(d => d.categoria === 'dividas' || d.frequencia === 'parcelada')
    .reduce((a, d) => a + despesaMensal(d), 0)
  const reservaMeta = essenciais * 6

  const porCategoria = ativas.reduce<Record<string, number>>((acc, d) => {
    acc[d.categoria] = (acc[d.categoria] ?? 0) + despesaMensal(d)
    return acc
  }, {})

  const alertas: Alerta[] = []

  if (renda === 0) {
    alertas.push({
      nivel: 'critico',
      titulo: 'Nenhuma renda cadastrada',
      texto: 'Sem a renda não há diagnóstico. Cadastre o salário líquido, as férias e o 13º na aba Rendas.',
    })
  }

  // 1. Saldo e taxa de poupança
  if (renda > 0 && saldo < 0) {
    alertas.push({
      nivel: 'critico',
      titulo: `Déficit de ${formatBRL(-saldo)} por mês`,
      texto: `No ano, isso dá ${formatBRL(-saldo * 12)} de dívida nova (cheque especial, cartão rotativo ou empréstimo). ` +
        (naoEssenciais >= -saldo
          ? `Os gastos não essenciais (${formatBRL(naoEssenciais)}) cobrem o rombo: cortar ${pct(-saldo, naoEssenciais).toFixed(0)}% deles já zera o déficit.`
          : `Mesmo cortando todos os não essenciais (${formatBRL(naoEssenciais)}), ainda faltam ${formatBRL(-saldo - naoEssenciais)}. Será preciso renegociar gastos essenciais ou aumentar a renda.`),
    })
  } else if (taxaPoupanca !== null && renda > 0) {
    if (taxaPoupanca < 10) {
      alertas.push({
        nivel: 'atencao',
        titulo: `Você poupa só ${taxaPoupanca.toFixed(0)}% da renda`,
        texto: `Qualquer imprevisto vira dívida. Para chegar a 10%, a sobra precisa subir ${formatBRL(renda * 0.1 - saldo)} por mês.`,
      })
    } else if (taxaPoupanca < 20) {
      alertas.push({
        nivel: 'oportunidade',
        titulo: `Taxa de poupança de ${taxaPoupanca.toFixed(0)}%: bom começo`,
        texto: `Para chegar a 20%, que é o patamar de quem constrói patrimônio, faltam ${formatBRL(renda * 0.2 - saldo)} por mês.`,
      })
    } else {
      alertas.push({
        nivel: 'ok',
        titulo: `Taxa de poupança de ${taxaPoupanca.toFixed(0)}%`,
        texto: 'Excelente patamar. O desafio é garantir que essa sobra seja de fato guardada no começo do mês, e não gasta.',
      })
    }
  }

  // 2. Comprometimento com dívidas
  if (renda > 0 && dividas > 0) {
    const p = pct(dividas, renda)
    alertas.push({
      nivel: p > 30 ? 'critico' : p > 15 ? 'atencao' : 'oportunidade',
      titulo: `${p.toFixed(0)}% da renda vai para dívidas e parcelas`,
      texto: p > 30
        ? `São ${formatBRL(dividas)} por mês. Acima de 30% é zona de risco. Priorize quitar ou renegociar as dívidas de juros mais altos (rotativo, cheque especial) e não faça nenhuma nova compra parcelada.`
        : `São ${formatBRL(dividas)} por mês. Cada parcela que termina é dinheiro que pode ir para a poupança. Não substitua por nova parcela.`,
    })
  }

  // 3. Parcelas que estão acabando
  const acabando = ativas.filter(d => d.frequencia === 'parcelada' && d.parcelas_restantes !== null && d.parcelas_restantes <= 3)
  if (acabando.length > 0) {
    const liberado = acabando.reduce((a, d) => a + d.valor, 0)
    alertas.push({
      nivel: 'oportunidade',
      titulo: `${formatBRL(liberado)}/mês serão liberados em até 3 meses`,
      texto: `Terminam em breve: ${acabando.map(d => d.descricao).join(', ')}. Quando acabarem, mantenha o valor "pagando" para a sua poupança. Seu orçamento já vive sem esse dinheiro.`,
    })
  }

  // 4. Regra 50/30/20: necessidades até 50% da renda
  if (renda > 0) {
    const pEss = pct(essenciais, renda)
    if (pEss > 60) {
      alertas.push({
        nivel: 'atencao',
        titulo: `Gastos essenciais consomem ${pEss.toFixed(0)}% da renda`,
        texto: 'A referência é até 50%. Quando o básico pesa tanto, o caminho é renegociar os grandes: moradia, escola, plano de saúde, carro. Cortar cafezinho não resolve.',
      })
    }
    const pNao = pct(naoEssenciais, renda)
    if (pNao > 30) {
      alertas.push({
        nivel: 'atencao',
        titulo: `Gastos não essenciais somam ${pNao.toFixed(0)}% da renda`,
        texto: `São ${formatBRL(naoEssenciais)} por mês. A referência é até 30%, e quem está no vermelho deve mirar bem menos, até a situação estabilizar.`,
      })
    }
  }

  // 5. Categorias acima da referência
  if (renda > 0) {
    for (const [cat, teto] of Object.entries(TETO_CATEGORIA)) {
      const valor = porCategoria[cat] ?? 0
      const p = pct(valor, renda)
      if (p > teto) {
        alertas.push({
          nivel: 'atencao',
          titulo: `${CATEGORIAS_DESPESA[cat].label}: ${p.toFixed(0)}% da renda`,
          texto: `A referência é até ${teto}%. Trazer para esse patamar libera ${formatBRL(valor - (renda * teto) / 100)} por mês.`,
        })
      }
    }
  }

  // 6. Assinaturas esquecidas
  const assinaturas = ativas.filter(d => d.categoria === 'assinaturas')
  if (assinaturas.length >= 3) {
    const total = assinaturas.reduce((a, d) => a + despesaMensal(d), 0)
    alertas.push({
      nivel: 'oportunidade',
      titulo: `${assinaturas.length} assinaturas somam ${formatBRL(total)}/mês`,
      texto: `Isso dá ${formatBRL(total * 12)} por ano. Cancele as que ninguém usou no último mês. Dá para reassinar depois, se fizer falta.`,
    })
  }

  // 7. "Outros" grande demais esconde vazamento
  const outros = porCategoria.outros ?? 0
  if (despesa > 0 && pct(outros, despesa) > 15) {
    alertas.push({
      nivel: 'atencao',
      titulo: `${pct(outros, despesa).toFixed(0)}% dos gastos estão em "Outros"`,
      texto: 'Quando muito dinheiro vai para "outros", é ali que estão os vazamentos. Detalhe esses gastos em categorias.',
    })
  }

  // 8. Gastos anuais pedem provisão mensal
  const anuais = ativas.filter(d => d.frequencia === 'anual')
  if (anuais.length > 0) {
    const provisao = anuais.reduce((a, d) => a + d.valor / 12, 0)
    alertas.push({
      nivel: 'oportunidade',
      titulo: `Separe ${formatBRL(provisao)}/mês para os gastos anuais`,
      texto: `${anuais.map(d => d.descricao).join(', ')}: se o dinheiro não for guardado mês a mês, essas contas viram cartão de crédito quando chegam.`,
    })
  }

  // 9. 13º e férias
  const temSalario = rendas.some(r => r.ativo && r.tipo === 'salario')
  const extrasAnuais = rendas.filter(r => r.ativo && (r.tipo === 'ferias' || r.tipo === 'decimo_terceiro'))
  if (temSalario && extrasAnuais.length === 0) {
    alertas.push({
      nivel: 'atencao',
      titulo: '13º e férias não cadastrados',
      texto: 'Se você é servidor ou CLT, essas entradas fazem parte da renda anual e são as melhores armas para quitar dívidas. Cadastre na aba Rendas.',
    })
  } else if (extrasAnuais.length > 0) {
    const total = extrasAnuais.reduce((a, r) => a + r.valor, 0)
    alertas.push({
      nivel: 'oportunidade',
      titulo: `${formatBRL(total)} de 13º e férias por ano`,
      texto: dividas > 0 || saldo < 0
        ? 'Decida agora, antes de receber, que esse dinheiro vai para quitar a dívida de juros mais altos. Dinheiro sem destino definido some.'
        : 'Decida agora, antes de receber, que esse dinheiro vai direto para a reserva e para os seus planos.',
    })
  }

  alertas.sort((a, b) => ORDEM_NIVEL[a.nivel] - ORDEM_NIVEL[b.nivel])

  // Trilha: estancar → mini reserva → quitar dívidas → reserva completa → objetivo
  const etapas: Omit<PassoPlano, 'status'>[] = [
    { titulo: 'Fechar o mês no azul', texto: 'Gastar menos do que entra, todo mês, sem exceção. Sem isso nenhum outro passo se sustenta.' },
    { titulo: `Mini reserva: ${formatBRL(essenciais)}`, texto: 'Um mês de gastos essenciais guardado, para que um imprevisto não vire dívida nova.' },
    { titulo: 'Quitar as dívidas caras', texto: 'Comece pelos juros mais altos (rotativo, cheque especial, empréstimo pessoal). Renegocie o que puder.' },
    { titulo: `Reserva de emergência: ${formatBRL(reservaMeta)}`, texto: 'Seis meses de gastos essenciais, numa aplicação segura com liquidez diária (Tesouro Selic ou CDB de liquidez diária).' },
    { titulo: 'Seus planos: mudança, estudo, carreira', texto: 'Com a base protegida, toda a sobra vai para os planos da aba Planos. Se o destino for o exterior, guarde parte já em dólar.' },
  ]

  // Sem saldos de conta cadastrados, só dá para inferir pelo fluxo mensal: no azul → foco na mini reserva
  const noAzul = renda > 0 && saldo >= 0
  const plano: PassoPlano[] = etapas.map((e, i) => {
    if (i === 0) return { ...e, status: noAzul ? 'feito' : 'atual' }
    if (i === 1) return { ...e, status: noAzul ? 'atual' : 'futuro' }
    if (i === 2 && noAzul && dividas === 0) return { ...e, status: 'feito' }
    return { ...e, status: 'futuro' }
  })

  return { renda, despesa, saldo, taxaPoupanca, essenciais, naoEssenciais, dividas, reservaMeta, alertas, plano }
}
