'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, formatDiaMes, hojeISO, nomeMes, parseBRL, type DizimoDevolvido } from '@/lib/financas'
import type { Conta } from '@/lib/contas'
import Sheet from '../_components/sheet'

interface Props {
  familiaId: string
  saida: Conta // tipo 'dizimo'
  onSaved: (competencia: string, d: DizimoDevolvido | null) => void
  onClose: () => void
}

/** Devolver o dízimo do mês: 10% da renda, ou mais, se o coração mandar. */
export default function DizimoSheet({ familiaId, saida, onSaved, onClose }: Props) {
  const supabase = createClient()
  const competencia = saida.competenciaDizimo!
  const devido = Math.round((saida.renda ?? 0) * 10) / 100
  const [valor, setValor] = useState((saida.dizimo ? Number(saida.dizimo.valor) : devido).toFixed(2).replace('.', ','))
  const [data, setData] = useState(saida.dizimo?.devolvido_em ?? hojeISO())
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function devolver() {
    const v = parseBRL(valor)
    if (!v) return setErro('Informe o valor.')
    setSaving(true)
    const registro = { competencia, valor: v, devolvido_em: data }
    const { error } = await supabase.from('fin_dizimos').upsert({ familia_id: familiaId, ...registro })
    setSaving(false)
    if (error) return setErro(`Não foi possível salvar. (${error.code}: ${error.message})`)
    onSaved(competencia, registro)
  }

  async function desfazer() {
    setSaving(true)
    const { error } = await supabase.from('fin_dizimos').delete().eq('familia_id', familiaId).eq('competencia', competencia)
    setSaving(false)
    if (error) return setErro(`Não foi possível desfazer. (${error.code}: ${error.message})`)
    onSaved(competencia, null)
  }

  const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
  const v = parseBRL(valor) ?? 0

  return (
    <Sheet titulo={`Dízimo de ${nomeMes(competencia).toLowerCase()}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-gray-900">
          <p className="text-sm">
            Renda do mês: <strong className="tabular-nums">{formatBRL(saida.renda ?? 0)}</strong>
          </p>
          <p className="text-sm">
            10% para devolver: <strong className="tabular-nums">{formatBRL(devido)}</strong>
          </p>
          <p className="mt-2 text-xs italic text-amber-900">
            “Honra ao Senhor com os teus bens e com as primícias de toda a tua renda.” Pv 3.9
          </p>
        </div>

        {saida.dizimo && (
          <p className="text-sm text-green-700">✓ Devolvido em {formatDiaMes(saida.dizimo.devolvido_em)}: {formatBRL(Number(saida.dizimo.valor))}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Valor devolvido</span>
            <input inputMode="decimal" value={valor} onChange={e => { setValor(e.target.value); setErro(null) }} className={inputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Devolvido em</span>
            <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputClass} />
          </label>
        </div>
        {v > 0 && v < devido - 0.005 && (
          <p className="text-xs text-amber-700">{formatBRL(devido - v)} abaixo dos 10%.</p>
        )}

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="button"
          onClick={devolver}
          disabled={saving}
          className="w-full rounded-lg bg-primary py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : saida.dizimo ? 'Salvar' : '✓ Devolvi'}
        </button>
        {saida.dizimo && (
          <button type="button" onClick={desfazer} disabled={saving} className="w-full text-sm text-red-600">
            Desfazer: ainda não devolvi
          </button>
        )}
      </div>
    </Sheet>
  )
}
