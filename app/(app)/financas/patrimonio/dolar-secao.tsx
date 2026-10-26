'use client'

import { useState } from 'react'
import { DollarSign, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCotacao, type Ptax } from '@/lib/cambio'
import { formatBRL, formatMoeda, hojeISO, parseBRL } from '@/lib/financas'
import type { CompraDolar } from '@/lib/patrimonio'
import Sheet from '../_components/sheet'

interface Props {
  familiaId: string
  userId: string
  compras: CompraDolar[]
  ptax: Ptax | null
  onChange: (compras: CompraDolar[]) => void
}

const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

/** Linha da PTAX dos últimos dias, em SVG simples. */
function Sparkline({ serie }: { serie: Ptax['serie'] }) {
  if (serie.length < 2) return null
  const valores = serie.map(s => s.venda)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const pontos = valores.map((v, i) => `${(i / (valores.length - 1)) * 100},${max === min ? 50 : 100 - ((v - min) / (max - min)) * 100}`).join(' ')
  const subiu = valores[valores.length - 1] >= valores[0]
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-10 w-full" aria-hidden="true">
      <polyline points={pontos} fill="none" strokeWidth="2.5" vectorEffect="non-scaling-stroke" className={subiu ? 'stroke-red-500' : 'stroke-green-600'} />
    </svg>
  )
}

export default function DolarSecao({ familiaId, userId, compras, ptax, onChange }: Props) {
  const supabase = createClient()
  const [editando, setEditando] = useState<CompraDolar | 'nova' | null>(null)
  const [form, setForm] = useState({ data: hojeISO(), usd: '', brl: '' })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const usd = compras.reduce((a, c) => a + Number(c.valor_usd), 0)
  const pago = compras.reduce((a, c) => a + Number(c.valor_brl), 0)
  const precoMedio = usd > 0 ? pago / usd : null
  const valeHoje = ptax ? usd * ptax.venda : null
  const resultado = valeHoje !== null ? valeHoje - pago : null

  const usdForm = parseBRL(form.usd) ?? 0
  const brlForm = parseBRL(form.brl) ?? 0
  const cotacaoEfetiva = usdForm > 0 && brlForm > 0 ? brlForm / usdForm : null

  function abrir(c: CompraDolar | 'nova') {
    setEditando(c)
    setErro(null)
    setForm(c === 'nova'
      ? { data: hojeISO(), usd: '', brl: '' }
      : { data: c.data, usd: Number(c.valor_usd).toFixed(2).replace('.', ','), brl: Number(c.valor_brl).toFixed(2).replace('.', ',') })
  }

  async function salvar() {
    if (!usdForm || !brlForm) return setErro('Informe quantos dólares e quanto pagou em reais.')
    setSaving(true)
    const payload = { data: form.data, valor_usd: usdForm, valor_brl: brlForm }
    const query = editando && editando !== 'nova'
      ? supabase.from('fin_compras_dolar').update(payload).eq('id', editando.id)
      : supabase.from('fin_compras_dolar').insert({ ...payload, familia_id: familiaId, user_id: userId })
    const { data, error } = await query.select().single()
    setSaving(false)
    if (error || !data) return setErro('Não foi possível salvar.')
    const salvo = data as CompraDolar
    onChange(editando && editando !== 'nova' ? compras.map(c => c.id === salvo.id ? salvo : c) : [salvo, ...compras])
    setEditando(null)
  }

  async function excluir() {
    if (!editando || editando === 'nova' || !confirm('Excluir esta compra?')) return
    const { error } = await supabase.from('fin_compras_dolar').delete().eq('id', editando.id)
    if (!error) {
      onChange(compras.filter(c => c.id !== editando.id))
      setEditando(null)
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">
          Dólar guardado {usd > 0 && <span className="text-muted-foreground font-normal">· {formatMoeda(usd, 'USD')}</span>}
        </h2>
        <button type="button" onClick={() => abrir('nova')} className="flex items-center gap-1 text-sm text-primary">
          <Plus className="h-4 w-4" /> Compra
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        {ptax ? (
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <p className="text-xs text-muted-foreground">PTAX hoje (Banco Central)</p>
              <p className="text-lg font-semibold tabular-nums">{formatCotacao(ptax.venda)}</p>
              <p className="text-[11px] text-muted-foreground">
                boletim de {new Date(`${ptax.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <Sparkline serie={ptax.serie} />
              <p className="text-right text-[10px] text-muted-foreground">últimos 45 dias</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Cotação do Banco Central indisponível agora. Tente mais tarde.</p>
        )}

        {usd > 0 && precoMedio !== null && (
          <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
            <div>
              <p className="text-[11px] text-muted-foreground">Preço médio</p>
              <p className="text-sm font-medium tabular-nums">{formatCotacao(precoMedio)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Vale hoje</p>
              <p className="text-sm font-medium tabular-nums">{valeHoje !== null ? formatBRL(valeHoje) : '—'}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Resultado</p>
              <p className={`text-sm font-medium tabular-nums ${resultado !== null && resultado >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {resultado !== null ? `${resultado >= 0 ? '+' : ''}${formatBRL(resultado)}` : '—'}
              </p>
            </div>
          </div>
        )}

        {compras.length > 0 ? (
          <ul className="divide-y divide-border border-t border-border">
            {compras.map(c => (
              <li key={c.id}>
                <button type="button" onClick={() => abrir(c)} className="flex w-full items-center gap-3 py-2 text-left text-sm active:bg-secondary/60">
                  <DollarSign className="h-4 w-4 flex-shrink-0 text-green-700" />
                  <span className="flex-1">
                    {formatMoeda(Number(c.valor_usd), 'USD')}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(`${c.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatBRL(Number(c.valor_brl))} · {formatCotacao(Number(c.valor_brl) / Number(c.valor_usd))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Se o destino é os EUA, comprar um pouco todo mês evita apostar tudo no câmbio de um único dia. Registre cada compra
            e o app calcula o preço médio.
          </p>
        )}
      </div>

      {editando && (
        <Sheet titulo={editando === 'nova' ? 'Compra de dólar' : 'Editar compra'} onClose={() => setEditando(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Dólares comprados (US$)</label>
                <input inputMode="decimal" value={form.usd} onChange={e => setForm(p => ({ ...p, usd: e.target.value }))} placeholder="0,00" className={inputClass} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Total pago (R$)</label>
                <input inputMode="decimal" value={form.brl} onChange={e => setForm(p => ({ ...p, brl: e.target.value }))} placeholder="0,00" className={inputClass} />
              </div>
            </div>
            <input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} className={inputClass} />
            {cotacaoEfetiva !== null && (
              <p className="text-xs text-muted-foreground">
                Cotação efetiva: <strong className="text-foreground">{formatCotacao(cotacaoEfetiva)}</strong>
                {ptax && ` · ${(((cotacaoEfetiva / ptax.venda) - 1) * 100).toFixed(1).replace('.', ',')}% acima da PTAX de hoje (spread + IOF)`}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">Use o total que saiu da conta, com IOF e taxas: é o custo real.</p>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button
              type="button"
              onClick={salvar}
              disabled={saving}
              className="w-full rounded-lg bg-primary py-3 text-base font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            {editando !== 'nova' && (
              <button type="button" onClick={excluir} className="w-full text-sm text-red-600">Excluir</button>
            )}
          </div>
        </Sheet>
      )}
    </section>
  )
}
