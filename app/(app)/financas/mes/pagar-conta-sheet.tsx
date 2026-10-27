'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { diaNoMes, formatBRL, hojeISO, nomeMes, parseBRL, type Despesa, type Lancamento } from '@/lib/financas'
import Sheet from '../_components/sheet'

interface Props {
  familiaId: string
  userId: string
  competencia: string
  despesa: Despesa
  onSaved: (l: Lancamento | null) => void
  onClose: () => void
}

/** Conta fixa do mês: confirma o valor real (luz, por exemplo, muda todo mês) e marca paga ou a pagar. */
export default function PagarContaSheet({ familiaId, userId, competencia, despesa, onSaved, onClose }: Props) {
  const supabase = createClient()
  const hoje = hojeISO()
  const [valor, setValor] = useState(Number(despesa.valor).toFixed(2).replace('.', ','))
  const [dia, setDia] = useState(despesa.dia_vencimento?.toString() ?? '')
  const vencimento = Number(dia) >= 1 && Number(dia) <= 31 ? diaNoMes(competencia, Number(dia)) : null
  const [pagoEm, setPagoEm] = useState(hoje.slice(0, 7) === competencia.slice(0, 7) ? hoje : (vencimento ?? competencia))
  const [saving, setSaving] = useState<'pago' | 'pendente' | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(pago: boolean) {
    const v = parseBRL(valor)
    if (!v) return setErro('Informe o valor.')
    if (!pago && !vencimento) return setErro('Informe o dia do vencimento.')
    setSaving(pago ? 'pago' : 'pendente')
    setErro(null)

    // Dia do vencimento novo ou corrigido vale para os próximos meses
    const novoDia = vencimento ? Number(dia) : null
    if (novoDia && novoDia !== despesa.dia_vencimento) {
      await supabase.from('fin_despesas').update({ dia_vencimento: novoDia, updated_at: new Date().toISOString() }).eq('id', despesa.id)
    }

    const data = pago ? pagoEm : vencimento!
    const { data: salvo, error } = await supabase.from('fin_lancamentos').insert({
      familia_id: familiaId,
      user_id: userId,
      data,
      vencimento: data,
      competencia, // a conta deste mês, mesmo se paga adiantada ou com atraso
      pago,
      descricao: despesa.descricao,
      valor: v,
      categoria: despesa.categoria,
      cartao_id: null,
      origem: 'fixo',
      despesa_id: despesa.id,
    }).select().single()
    setSaving(null)
    if (error || !salvo) return setErro(`Não foi possível salvar.${error ? ` (${error.code}: ${error.message})` : ''}`)
    onSaved(salvo as Lancamento)
  }

  const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
  const valorNum = parseBRL(valor) ?? 0
  const diferenca = valorNum - Number(despesa.valor)

  return (
    <Sheet titulo={despesa.descricao} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Conta de {nomeMes(competencia).toLowerCase()}</p>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Valor deste mês</span>
            <input inputMode="decimal" value={valor} onChange={e => { setValor(e.target.value); setErro(null) }} className={inputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Vence todo dia</span>
            <input type="number" min={1} max={31} value={dia} onChange={e => { setDia(e.target.value); setErro(null) }} placeholder="10" className={inputClass} />
          </label>
        </div>
        {Math.abs(diferenca) >= 0.01 && valorNum > 0 && (
          <p className={`text-xs ${diferenca > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            {formatBRL(Math.abs(diferenca))} {diferenca > 0 ? 'acima' : 'abaixo'} do previsto ({formatBRL(Number(despesa.valor))})
          </p>
        )}

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Pago em</span>
          <input type="date" value={pagoEm} onChange={e => setPagoEm(e.target.value)} className={inputClass} />
        </label>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="button"
          onClick={() => salvar(true)}
          disabled={!!saving}
          className="w-full rounded-lg bg-green-600 py-3 text-base font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {saving === 'pago' ? 'Salvando...' : '✓ Paguei'}
        </button>
        <button
          type="button"
          onClick={() => salvar(false)}
          disabled={!!saving}
          className="w-full rounded-lg border border-border py-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
        >
          {saving === 'pendente' ? 'Salvando...' : 'Ainda não paguei: guardar o valor como a pagar'}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Para mudar o valor previsto ou desativar a conta, vá em{' '}
          <Link href="/financas/gastos" className="text-primary underline">Orçamento → Gastos fixos</Link>.
        </p>
      </div>
    </Sheet>
  )
}
