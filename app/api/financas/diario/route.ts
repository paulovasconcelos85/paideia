import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { carregarAiConfig } from '@/lib/ai'
import { buscarPtax } from '@/lib/cambio'
import { gerarCarta } from '@/lib/carta'
import { MESES, faturaPagaNoMes, formatBRL, type Cartao, type Despesa, type Renda } from '@/lib/financas'
import { enviarPush } from '@/lib/push'

export const maxDuration = 300

// Data de hoje no fuso de Brasília, independente do fuso do servidor
function hojeBrasil() {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date()).split('-').map(Number)
  return new Date(partes[0], partes[1] - 1, partes[2], 12)
}

const isoMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
const isoDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Próxima data em que cai um "dia X" do mês (ajusta meses curtos). */
function proximoDia(hoje: Date, dia: number) {
  const ajustar = (ano: number, mes: number) => new Date(ano, mes, Math.min(dia, new Date(ano, mes + 1, 0).getDate()), 12)
  const esteMes = ajustar(hoje.getFullYear(), hoje.getMonth())
  return esteMes >= hoje ? esteMes : ajustar(hoje.getFullYear(), hoje.getMonth() + 1)
}

const diasAte = (hoje: Date, data: Date) => Math.round((data.getTime() - hoje.getTime()) / 86400000)

// Cron diário (vercel.json): carta do mês no dia 1 e lembretes por push
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const hoje = hojeBrasil()
  const competencia = isoMes(hoje)
  const resumo = { cartas: 0, lembretes: 0, erros: [] as string[] }

  const [{ data: familias }, { data: inscritas }] = await Promise.all([
    supabase.from('fin_membros').select('familia_id, user_id').eq('papel', 'titular'),
    supabase.from('fin_push').select('familia_id'),
  ])
  const comPush = new Set((inscritas ?? []).map(i => i.familia_id))

  // ── Dia 1: carta do mês
  if (hoje.getDate() === 1) {
    const ptax = await buscarPtax()
    const { data: jaEscritas } = await supabase.from('fin_cartas').select('familia_id').eq('mes', competencia)
    const escritas = new Set((jaEscritas ?? []).map(c => c.familia_id))

    for (const { familia_id, user_id } of familias ?? []) {
      if (escritas.has(familia_id)) continue
      try {
        const aiConfig = await carregarAiConfig(supabase, user_id) // usa a chave de IA do titular
        if ('error' in aiConfig) continue
        const carta = await gerarCarta(supabase, familia_id, aiConfig, ptax?.venda ?? null)
        if (!carta) continue
        resumo.cartas++
        if (comPush.has(familia_id)) {
          await enviarPush(supabase, { familiaId: familia_id }, {
            titulo: `A carta de ${MESES[hoje.getMonth()].toLowerCase()} chegou`,
            corpo: carta.slice(0, 110) + (carta.length > 110 ? '…' : ''),
            url: '/financas',
            tag: 'carta',
          })
        }
      } catch (e) {
        resumo.erros.push(`carta ${familia_id}: ${(e as Error).message}`)
      }
    }
  }

  // ── Lembretes: só para famílias com algum aparelho inscrito
  const ids = Array.from(comPush)
  if (ids.length > 0) {
    const amanhaISO = isoDia(new Date(hoje.getTime() + 86400000))
    const [{ data: cartoes }, { data: despesas }, { data: rendas }, { data: lancamentos }, { data: faturasPagas }, { data: aPagar }] = await Promise.all([
      supabase.from('fin_cartoes').select('*').in('familia_id', ids),
      supabase.from('fin_despesas').select('*').in('familia_id', ids).eq('ativo', true).is('cartao_id', null),
      supabase.from('fin_rendas').select('*').in('familia_id', ids).eq('ativo', true).eq('frequencia', 'anual'),
      supabase.from('fin_lancamentos').select('familia_id, cartao_id, despesa_id, valor, competencia').in('familia_id', ids)
        .in('competencia', [isoMes(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)), competencia]),
      supabase.from('fin_faturas').select('cartao_id, competencia').in('familia_id', ids),
      // Lançadas como "a pagar" que vencem amanhã
      supabase.from('fin_lancamentos').select('familia_id, descricao, valor').in('familia_id', ids)
        .is('cartao_id', null).eq('pago', false).eq('vencimento', amanhaISO),
    ])
    const faturaPaga = new Set((faturasPagas ?? []).map(f => `${f.cartao_id}|${String(f.competencia).slice(0, 10)}`))

    for (const familiaId of ids) {
      const avisos: { titulo: string; corpo: string; url: string; tag: string }[] = []
      const lancFamilia = (lancamentos ?? []).filter(l => l.familia_id === familiaId)
      const lancMes = lancFamilia.filter(l => String(l.competencia).slice(0, 10) === competencia)

      // Fatura vencendo em 3 dias
      for (const c of ((cartoes ?? []) as (Cartao & { familia_id: string })[]).filter(c => c.familia_id === familiaId && c.dia_vencimento)) {
        const vence = proximoDia(hoje, c.dia_vencimento!)
        if (diasAte(hoje, vence) === 3) {
          // Qual fatura vence nessa data; se já foi paga, não lembra
          const fatura = faturaPagaNoMes(c, isoMes(vence))
          if (faturaPaga.has(`${c.id}|${fatura}`)) continue
          const lancado = lancFamilia.filter(l => l.cartao_id === c.id && String(l.competencia).slice(0, 10) === fatura).reduce((a, l) => a + Number(l.valor), 0)
          avisos.push({
            titulo: `Fatura do ${c.nome} vence em 3 dias`,
            corpo: lancado > 0 ? `${formatBRL(lancado)} lançados nesta fatura. Separe o valor para pagar o total.` : 'Pague o total para fugir dos juros do rotativo.',
            url: '/financas/mes',
            tag: `fatura-${c.id}`,
          })
        }
      }

      // Contas fora do cartão que vencem amanhã e ainda não foram lançadas
      const lancadas = new Set(lancMes.map(l => l.despesa_id).filter(Boolean))
      const amanha: { descricao: string; valor: number }[] = [
        ...((despesas ?? []) as (Despesa & { familia_id: string })[]).filter(d =>
          d.familia_id === familiaId && d.frequencia !== 'anual' && d.dia_vencimento &&
          !lancadas.has(d.id) && diasAte(hoje, proximoDia(hoje, d.dia_vencimento)) === 1
        ),
        ...(aPagar ?? []).filter(l => l.familia_id === familiaId),
      ]
      if (amanha.length > 0) {
        avisos.push({
          titulo: amanha.length === 1 ? `${amanha[0].descricao} vence amanhã` : `${amanha.length} contas vencem amanhã`,
          corpo: `${amanha.map(d => d.descricao).join(', ')}: ${formatBRL(amanha.reduce((a, d) => a + Number(d.valor), 0))}`,
          url: '/financas/mes',
          tag: 'contas-amanha',
        })
      }

      // Dia 1: 13º ou férias chegando neste mês
      if (hoje.getDate() === 1) {
        const extras = ((rendas ?? []) as (Renda & { familia_id: string })[]).filter(r =>
          r.familia_id === familiaId && r.mes_recebimento === hoje.getMonth() + 1
        )
        if (extras.length > 0) {
          avisos.push({
            titulo: `${extras.map(r => r.descricao).join(' e ')} chega este mês`,
            corpo: `${formatBRL(extras.reduce((a, r) => a + Number(r.valor), 0))}. Decida o destino antes de o dinheiro cair.`,
            url: '/financas/planos',
            tag: 'renda-extra',
          })
        }
      }

      for (const aviso of avisos) {
        resumo.lembretes += await enviarPush(supabase, { familiaId }, aviso)
      }
    }
  }

  return NextResponse.json({ ok: true, data: competencia, ...resumo })
}
