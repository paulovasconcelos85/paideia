'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIAS_DESPESA, despesaMensal, formatBRL, parseBRL, type Despesa } from '@/lib/financas'
import Sheet from '../_components/sheet'

interface Props {
  familiaId: string
  tetos: Record<string, number>
  despesas: Despesa[]
  onSaved: (tetos: Record<string, number>) => void
  onClose: () => void
}

const texto = (n: number | undefined) => (n ? Number(n).toFixed(2).replace('.', ',') : '')

export default function TetosSheet({ familiaId, tetos, despesas, onSaved, onClose }: Props) {
  const supabase = createClient()
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(Object.keys(CATEGORIAS_DESPESA).map(c => [c, texto(tetos[c])]))
  )
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const total = Object.values(valores).reduce((a, v) => a + (parseBRL(v) ?? 0), 0)

  // Ponto de partida: o que o orçamento de gastos fixos já prevê em cada categoria
  function sugerir() {
    const previsto = despesas.reduce<Record<string, number>>((acc, d) => {
      acc[d.categoria] = (acc[d.categoria] ?? 0) + despesaMensal(d)
      return acc
    }, {})
    setValores(prev => Object.fromEntries(
      Object.keys(prev).map(c => [c, prev[c] || texto(previsto[c] ? Math.ceil(previsto[c] / 10) * 10 : undefined)])
    ))
  }

  async function salvar() {
    setSaving(true)
    const novos = Object.fromEntries(
      Object.entries(valores).map(([c, v]) => [c, parseBRL(v) ?? 0]).filter(([, v]) => (v as number) > 0)
    ) as Record<string, number>
    const { error } = await supabase.from('fin_familias').update({ tetos: novos }).eq('id', familiaId)
    setSaving(false)
    if (error) return setErro('Não foi possível salvar os limites.')
    onSaved(novos)
  }

  return (
    <Sheet titulo="Limites do mês" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Quanto a família combina gastar, no máximo, em cada categoria. Deixe em branco o que não quiser limitar.
        </p>
        <button type="button" onClick={sugerir} className="text-sm text-primary hover:underline">
          Preencher com o que o orçamento prevê
        </button>

        <div className="space-y-2">
          {Object.entries(CATEGORIAS_DESPESA).map(([c, { label, descricao }]) => (
            <div key={c} className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{descricao}</span>
              </span>
              <div className="relative w-36">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                <input
                  inputMode="decimal"
                  value={valores[c]}
                  onChange={e => setValores(p => ({ ...p, [c]: e.target.value }))}
                  placeholder="—"
                  className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="font-medium">Total combinado</span>
          <span className="font-semibold tabular-nums">{formatBRL(total)}</span>
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="button"
          onClick={salvar}
          disabled={saving}
          className="w-full rounded-lg bg-primary py-3 text-base font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar limites'}
        </button>
      </div>
    </Sheet>
  )
}
