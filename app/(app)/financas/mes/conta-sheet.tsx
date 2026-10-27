'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, parseBRL, type Lancamento } from '@/lib/financas'
import type { Conta } from '@/lib/contas'
import Sheet from '../_components/sheet'

interface Props {
  familiaId: string
  userId: string
  competencia: string
  conta: Conta // tipo 'conta'
  onSaved: (l: Lancamento) => void
  onDeleted: (id: string) => void
  onCadastroAlterado: () => void // a conta fixa mudou (nome, valor padrão, pausa): recarrega
  onClose: () => void
}

/** Detalhe de uma conta do mês: valor, vencimento e se foi paga. Na conta fixa, pode valer para os próximos meses. */
export default function ContaSheet({ familiaId, userId, competencia, conta, onSaved, onDeleted, onCadastroAlterado, onClose }: Props) {
  const supabase = createClient()
  const d = conta.despesa
  const l = conta.lancamento
  const [descricao, setDescricao] = useState(conta.descricao)
  const [valor, setValor] = useState(conta.valor.toFixed(2).replace('.', ','))
  const [vencimento, setVencimento] = useState(conta.vencimento ?? competencia)
  const [pago, setPago] = useState(conta.pago)
  const [proximos, setProximos] = useState(false) // aplicar valor e dia aos próximos meses
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const repeticao = !d ? 'Só neste mês'
    : d.frequencia === 'parcelada' ? `Parcelada${conta.parcela ? ` (${conta.parcela})` : ''}`
    : 'Todo mês'

  async function salvar() {
    const v = parseBRL(valor)
    if (v === null) return setErro('Informe o valor.')
    if (!vencimento) return setErro('Informe o vencimento.')
    setSaving(true)
    setErro(null)
    let cadastroMudou = false

    if (d && (descricao.trim() !== d.descricao || proximos)) {
      const { error } = await supabase.from('fin_despesas').update({
        descricao: descricao.trim() || d.descricao,
        ...(proximos ? { valor: v, dia_vencimento: Number(vencimento.slice(8, 10)) } : {}),
        updated_at: new Date().toISOString(),
      }).eq('id', d.id)
      if (error) { setSaving(false); return setErro(`Não foi possível salvar. (${error.code}: ${error.message})`) }
      cadastroMudou = true
    }

    const dados = { descricao: descricao.trim() || conta.descricao, valor: v, vencimento, pago }
    const { data: salvo, error } = l
      ? await supabase.from('fin_lancamentos').update(dados).eq('id', l.id).select().single()
      : await supabase.from('fin_lancamentos').insert({
          ...dados, familia_id: familiaId, user_id: userId, data: vencimento, competencia,
          categoria: conta.categoria ?? 'contas', cartao_id: null, origem: 'fixo', despesa_id: d?.id ?? null,
        }).select().single()
    setSaving(false)
    if (error || !salvo) return setErro(`Não foi possível salvar.${error ? ` (${error.code}: ${error.message})` : ''}`)
    onSaved(salvo as Lancamento)
    if (cadastroMudou) onCadastroAlterado()
  }

  async function pausar() {
    if (!d || !confirm(`Pausar "${d.descricao}"? Ela some dos próximos meses até você retomar.`)) return
    const { error } = await supabase.from('fin_despesas').update({ ativo: false, updated_at: new Date().toISOString() }).eq('id', d.id)
    if (error) return setErro(`Não foi possível pausar. (${error.code}: ${error.message})`)
    if (l && !l.pago) await supabase.from('fin_lancamentos').delete().eq('id', l.id)
    onCadastroAlterado()
    onClose()
  }

  async function excluirDoMes() {
    if (!l) return
    const pergunta = d ? 'Desfazer as mudanças deste mês? A conta volta ao valor e ao dia padrão.' : 'Excluir esta conta?'
    if (!confirm(pergunta)) return
    const { error } = await supabase.from('fin_lancamentos').delete().eq('id', l.id)
    if (error) return setErro(`Não foi possível excluir. (${error.code}: ${error.message})`)
    onDeleted(l.id)
  }

  const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <Sheet titulo={conta.descricao} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {repeticao}{d && d.frequencia === 'mensal' ? ` · padrão ${formatBRL(Number(d.valor))}, dia ${d.dia_vencimento ?? '—'}` : ''}
        </p>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Nome</span>
          <input value={descricao} onChange={e => setDescricao(e.target.value)} className={inputClass} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Valor</span>
            <input inputMode="decimal" value={valor} onChange={e => { setValor(e.target.value); setErro(null) }} className={inputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Vencimento</span>
            <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className={inputClass} />
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPago(false)}
            className={`flex-1 rounded-full border px-3 py-2 text-sm ${!pago ? 'border-red-300 bg-red-50 font-medium text-red-700' : 'border-border'}`}
          >
            A pagar
          </button>
          <button
            type="button"
            onClick={() => setPago(true)}
            className={`flex-1 rounded-full border px-3 py-2 text-sm ${pago ? 'border-green-300 bg-green-50 font-medium text-green-700' : 'border-border'}`}
          >
            ✓ Pago
          </button>
        </div>

        {d && d.frequencia === 'mensal' && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={proximos} onChange={e => setProximos(e.target.checked)} className="h-4 w-4" />
            Usar este valor e este dia nos próximos meses
          </label>
        )}

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="button"
          onClick={salvar}
          disabled={saving}
          className="w-full rounded-lg bg-primary py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>

        <div className="flex justify-between text-sm">
          {l ? (
            <button type="button" onClick={excluirDoMes} className="text-muted-foreground hover:text-red-600">
              {d ? 'Desfazer mudanças do mês' : 'Excluir'}
            </button>
          ) : <span />}
          {d && (
            <button type="button" onClick={pausar} className="text-muted-foreground hover:text-red-600">
              Pausar esta conta
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
