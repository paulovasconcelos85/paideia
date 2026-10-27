'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  espelharLancamento, formatBRL, hojeISO, rendaDoMes, somarMeses,
  type Aporte, type Cartao, type Despesa, type DizimoDevolvido, type FaturaPaga, type Lancamento, type Plano, type Receita, type Renda,
} from '@/lib/financas'
import { montarContas, type Conta } from '@/lib/contas'

interface Props {
  ano: number
  familiaId: string
  userId: string
  lancamentos: Lancamento[]
  despesas: Despesa[]
  cartoes: Cartao[]
  rendas: Renda[]
  receitas: Receita[]
  planos: Plano[]
  aportes: Aporte[]
  faturasPagas: FaturaPaga[]
  dizimoDesde: string | null
  dizimos: DizimoDevolvido[]
}

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

interface Celula {
  contas: Conta[]
  valor: number
  pago: boolean
  vencida: boolean
}

// Cada conta cai numa coluna: a conta fixa, o cartão, o dízimo ou "outras" (as avulsas)
function colunaDe(c: Conta): string {
  if (c.tipo === 'dizimo') return 'dizimo'
  if (c.tipo === 'fatura') return `f-${c.cartao!.id}`
  if (c.tipo === 'aporte') return `a-${c.plano!.id}`
  return c.despesa ? `d-${c.despesa.id}` : 'outras'
}

/** O ano numa grade, como a planilha: um mês por linha, uma conta por coluna, vermelho a pagar e verde pago. */
export default function AnoClient({ ano, familiaId, userId, lancamentos: brutos, despesas, cartoes, rendas, receitas, planos, aportes, faturasPagas, dizimoDesde, dizimos }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()
  const hoje = hojeISO()
  const mesAtual = `${hoje.slice(0, 7)}-01`

  // Marcações feitas aqui valem na hora; somem quando os dados novos chegam do servidor
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({})
  useEffect(() => { setMarcadas({}) }, [brutos, faturasPagas, dizimos, aportes])

  const { meses, colunas, rotulos } = useMemo(() => {
    const lancamentos = brutos.map(l => espelharLancamento(l, despesas))
    const meses = Array.from({ length: 12 }, (_, i) => {
      const mes = `${ano}-${String(i + 1).padStart(2, '0')}-01`
      const anterior = somarMeses(mes, -1)
      const contas = montarContas({
        mes,
        lancamentos: lancamentos.filter(l => l.competencia === mes),
        atrasados: [],
        cartoes,
        despesas,
        faturasPagas,
        faturaAnterior: lancamentos.filter(l => l.competencia === anterior && l.cartao_id),
        rendas,
        receitas,
        planos,
        aportes,
        dizimos,
        dizimoDesde,
        verAtrasos: false,
      })
      const celulas: Record<string, Celula> = {}
      for (const c of contas) {
        const k = colunaDe(c)
        const cel = (celulas[k] ??= { contas: [], valor: 0, pago: true, vencida: false })
        cel.contas.push(c)
        cel.valor += c.valor
        cel.pago &&= c.pago
        cel.vencida ||= !c.pago && !!c.vencimento && c.vencimento < hoje
      }
      const recebida = receitas.some(r => r.competencia.slice(0, 10) === mes && r.tipo !== 'saldo')
      return { mes, celulas, total: contas.reduce((a, c) => a + c.valor, 0), renda: rendaDoMes(rendas, mes, receitas), recebida }
    })

    // Colunas na ordem da planilha: dízimo, contas fixas pelo dia de vencimento, cartões, avulsas
    const usadas = new Set(meses.flatMap(m => Object.keys(m.celulas)))
    const fixas = despesas
      .filter(d => usadas.has(`d-${d.id}`))
      .sort((a, b) => (a.dia_vencimento ?? 99) - (b.dia_vencimento ?? 99) || a.descricao.localeCompare(b.descricao))
    const colunas = [
      ...(usadas.has('dizimo') ? ['dizimo'] : []),
      ...planos.filter(p => usadas.has(`a-${p.id}`)).map(p => `a-${p.id}`),
      ...fixas.map(d => `d-${d.id}`),
      ...cartoes.filter(c => usadas.has(`f-${c.id}`)).map(c => `f-${c.id}`),
      ...(usadas.has('outras') ? ['outras'] : []),
    ]
    const rotulos: Record<string, string> = { dizimo: 'Dízimo', outras: 'Outras contas' }
    for (const d of fixas) rotulos[`d-${d.id}`] = d.descricao
    for (const c of cartoes) rotulos[`f-${c.id}`] = c.nome
    for (const p of planos) rotulos[`a-${p.id}`] = `Guardar: ${p.titulo}`
    return { meses, colunas, rotulos }
  }, [ano, brutos, despesas, cartoes, rendas, receitas, planos, aportes, faturasPagas, dizimos, dizimoDesde, hoje])

  const pagoDe = (mes: string, col: string, cel: Celula) => marcadas[`${mes}|${col}`] ?? cel.pago

  async function alternar(mes: string, col: string, cel: Celula) {
    // Célula com mais de uma conta (avulsas): abre o mês para ver uma a uma
    if (cel.contas.length !== 1) return router.push(`/financas/mes?mes=${mes.slice(0, 7)}`)
    const c = cel.contas[0]
    const novo = !pagoDe(mes, col, cel)
    setMarcadas(prev => ({ ...prev, [`${mes}|${col}`]: novo }))

    let erro: unknown = null
    if (c.tipo === 'conta' && c.lancamento) {
      ({ error: erro } = await supabase.from('fin_lancamentos').update({ pago: novo }).eq('id', c.lancamento.id))
    } else if (c.tipo === 'conta' && c.despesa) {
      const venc = c.vencimento ?? mes
      ;({ error: erro } = await supabase.from('fin_lancamentos').insert({
        familia_id: familiaId, user_id: userId, data: venc, vencimento: venc, competencia: mes, pago: novo,
        descricao: c.despesa.descricao, valor: c.valor, categoria: c.despesa.categoria, cartao_id: null, origem: 'fixo', despesa_id: c.despesa.id,
      }))
    } else if (c.tipo === 'fatura' && c.cartao && c.competenciaFatura) {
      ({ error: erro } = novo
        ? await supabase.from('fin_faturas').insert({ familia_id: familiaId, cartao_id: c.cartao.id, competencia: c.competenciaFatura })
        : await supabase.from('fin_faturas').delete().eq('cartao_id', c.cartao.id).eq('competencia', c.competenciaFatura))
    } else if (c.tipo === 'aporte' && c.plano) {
      ({ error: erro } = await supabase.from('fin_aportes').upsert(
        { familia_id: familiaId, plano_id: c.plano.id, competencia: mes, valor: c.valor, pago: novo, data: hoje },
        { onConflict: 'plano_id,competencia' },
      ))
    } else if (c.tipo === 'dizimo' && c.competenciaDizimo) {
      ({ error: erro } = novo
        ? await supabase.from('fin_dizimos').upsert({ familia_id: familiaId, competencia: c.competenciaDizimo, valor: c.valor, devolvido_em: hoje })
        : await supabase.from('fin_dizimos').delete().eq('familia_id', familiaId).eq('competencia', c.competenciaDizimo))
    }

    if (erro) {
      setMarcadas(prev => { const n = { ...prev }; delete n[`${mes}|${col}`]; return n })
      return alert('Não foi possível atualizar. Tente de novo.')
    }
    startTransition(() => router.refresh())
  }

  const totalAno = meses.reduce((a, m) => a + m.total, 0)
  const pagoAno = meses.reduce((a, m) => a + Object.entries(m.celulas).reduce((s, [col, cel]) => s + (pagoDe(m.mes, col, cel) ? cel.valor : 0), 0), 0)
  const somaColuna = (col: string) => meses.reduce((a, m) => a + (m.celulas[col]?.valor ?? 0), 0)

  const fixa = 'sticky left-0 z-10 bg-card'
  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <Link href={`/financas/ano?ano=${ano - 1}`} className="-ml-2 p-2 text-muted-foreground hover:text-foreground" aria-label="Ano anterior">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="font-semibold">{ano}</h2>
        <Link href={`/financas/ano?ano=${ano + 1}`} className="-mr-2 p-2 text-muted-foreground hover:text-foreground" aria-label="Próximo ano">
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-card p-3 text-center">
        <div>
          <p className="text-[11px] text-muted-foreground">Contas no ano</p>
          <p className="text-sm font-semibold tabular-nums">{formatBRL(totalAno)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Pago</p>
          <p className="text-sm font-semibold tabular-nums text-green-700">{formatBRL(pagoAno)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">A pagar</p>
          <p className="text-sm font-semibold tabular-nums text-red-600">{formatBRL(totalAno - pagoAno)}</p>
        </div>
      </div>

      {colunas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhuma conta em {ano}.</p>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-card">
          <table className="border-separate border-spacing-0 text-xs tabular-nums">
            <thead className="sticky top-0 z-20">
              <tr className="bg-secondary">
                <th className={`${fixa} z-30 border-b border-r border-border bg-secondary px-3 py-2 text-left font-medium`}>Mês</th>
                <th className="border-b border-r border-border px-3 py-2 text-right font-medium text-blue-700">Renda</th>
                <th className="border-b border-r border-border px-3 py-2 text-right font-medium">Total</th>
                <th className="border-b border-r border-border px-3 py-2 text-right font-medium">Sobra</th>
                {colunas.map(col => (
                  <th key={col} className="min-w-[88px] max-w-[110px] border-b border-r border-border px-2 py-2 text-right font-medium leading-tight">
                    {rotulos[col]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meses.map(m => {
                const atual = m.mes === mesAtual
                const sobra = m.renda - m.total
                return (
                  <tr key={m.mes} className={atual ? 'bg-primary/5' : ''}>
                    <td className={`${fixa} border-b border-r border-border px-3 py-2 ${atual ? 'font-semibold text-primary' : ''}`}>
                      <Link href={`/financas/mes?mes=${m.mes.slice(0, 7)}`} className="whitespace-nowrap hover:underline">
                        {MES_CURTO[Number(m.mes.slice(5, 7)) - 1]}./{ano}
                      </Link>
                    </td>
                    <td className={`border-b border-r border-border px-3 py-2 text-right ${m.recebida ? 'text-blue-700' : 'text-blue-400'}`}>
                      {m.renda > 0 && (m.recebida || m.mes >= mesAtual) ? formatBRL(m.renda) : ''}
                    </td>
                    <td className="border-b border-r border-border px-3 py-2 text-right font-semibold">{m.total ? formatBRL(m.total) : ''}</td>
                    <td className={`border-b border-r border-border px-3 py-2 text-right ${sobra >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {/* Com entrada registrada, a sobra é real; sem ela, só vale como previsão do mês atual em diante */}
                      {m.renda > 0 && m.total > 0 && (m.recebida || m.mes >= mesAtual) ? formatBRL(sobra) : ''}
                    </td>
                    {colunas.map(col => {
                      const cel = m.celulas[col]
                      if (!cel) return <td key={col} className="border-b border-r border-border" />
                      const pago = pagoDe(m.mes, col, cel)
                      return (
                        <td key={col} className="border-b border-r border-border p-0">
                          <button
                            type="button"
                            onClick={() => alternar(m.mes, col, cel)}
                            title={cel.contas.length === 1 ? (pago ? 'Pago: tocar para voltar a "a pagar"' : 'A pagar: tocar para marcar como pago') : 'Abrir o mês'}
                            className={`w-full px-2 py-2 text-right hover:bg-secondary/60 ${pago ? 'text-green-700' : 'text-red-600'} ${cel.vencida && !pago ? 'font-bold' : ''}`}
                          >
                            {formatBRL(cel.valor)}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="sticky bottom-0">
              <tr className="bg-secondary font-semibold">
                <td className={`${fixa} border-r border-border bg-secondary px-3 py-2`}>Ano</td>
                <td className="border-r border-border px-3 py-2 text-right text-blue-700">
                  {formatBRL(meses.reduce((a, m) => a + (m.recebida || m.mes >= mesAtual ? m.renda : 0), 0))}
                </td>
                <td className="border-r border-border px-3 py-2 text-right">{formatBRL(totalAno)}</td>
                <td className="border-r border-border" />
                {colunas.map(col => (
                  <td key={col} className="border-r border-border px-2 py-2 text-right">{formatBRL(somaColuna(col))}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        <span className="text-red-600">Vermelho</span> = a pagar (em negrito, vencido) · <span className="text-green-700">verde</span> = pago.
        Toque no valor para alternar; no mês, para ver os detalhes e mudar valores.
      </p>
    </div>
  )
}
