'use client'

import { useState } from 'react'
import { CreditCard, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, parseBRL, type Cartao } from '@/lib/financas'

interface Props {
  userId: string
  cartoes: Cartao[]
  onChange: (cartoes: Cartao[]) => void
  onClose: () => void
}

const FORM_VAZIO = { nome: '', dia_vencimento: '', dia_fechamento: '', limite: '' }
const inputClass = 'w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring'

export default function CartoesModal({ userId, cartoes, onChange, onClose }: Props) {
  const supabase = createClient()
  const [form, setForm] = useState(FORM_VAZIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function editar(c: Cartao) {
    setEditandoId(c.id)
    setForm({
      nome: c.nome,
      dia_vencimento: c.dia_vencimento?.toString() ?? '',
      dia_fechamento: c.dia_fechamento?.toString() ?? '',
      limite: c.limite ? Number(c.limite).toFixed(2).replace('.', ',') : '',
    })
    setErro(null)
  }

  async function salvar() {
    if (!form.nome.trim()) return setErro('Dê um nome ao cartão. Ex: Nubank, Itaú Visa.')
    setSaving(true)
    const payload = {
      user_id: userId,
      nome: form.nome.trim(),
      dia_vencimento: form.dia_vencimento ? Number(form.dia_vencimento) : null,
      dia_fechamento: form.dia_fechamento ? Number(form.dia_fechamento) : null,
      limite: form.limite ? parseBRL(form.limite) : null,
    }
    const query = editandoId
      ? supabase.from('fin_cartoes').update(payload).eq('id', editandoId)
      : supabase.from('fin_cartoes').insert(payload)
    const { data, error } = await query.select().single()
    setSaving(false)
    if (error || !data) return setErro('Não foi possível salvar o cartão.')

    const salvo = data as Cartao
    onChange(editandoId ? cartoes.map(c => c.id === editandoId ? salvo : c) : [...cartoes, salvo])
    setEditandoId(null)
    setForm(FORM_VAZIO)
    setErro(null)
  }

  async function excluir(c: Cartao) {
    if (!confirm(`Excluir o cartão "${c.nome}"? Os gastos dele não são apagados: passam para "fora do cartão".`)) return
    const { error } = await supabase.from('fin_cartoes').delete().eq('id', c.id)
    if (!error) onChange(cartoes.filter(x => x.id !== c.id))
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-background rounded-t-2xl sm:rounded-xl border border-border w-full sm:max-w-lg shadow-xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 space-y-5 max-h-[92vh] overflow-y-auto">
        <h2 className="text-lg font-semibold">Cartões de crédito</h2>

        {cartoes.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {cartoes.map(c => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                <CreditCard className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      c.dia_vencimento && `vence dia ${c.dia_vencimento}`,
                      c.dia_fechamento && `fecha dia ${c.dia_fechamento}`,
                      c.limite && `limite ${formatBRL(Number(c.limite))}`,
                    ].filter(Boolean).join(' · ') || 'sem detalhes'}
                  </p>
                </div>
                <button type="button" onClick={() => editar(c)} className="p-1.5 text-muted-foreground hover:text-foreground" title="Editar">
                  <Pencil className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => excluir(c)} className="p-1.5 text-muted-foreground hover:text-red-600" title="Excluir">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-4 rounded-lg border border-border p-4">
          <p className="text-sm font-medium">{editandoId ? 'Editar cartão' : 'Adicionar cartão'}</p>
          <input
            value={form.nome}
            onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
            placeholder="Nome do cartão (ex: Nubank, Itaú Visa)"
            className={inputClass}
          />
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Vencimento</label>
              <input type="number" min={1} max={31} value={form.dia_vencimento}
                onChange={e => setForm(p => ({ ...p, dia_vencimento: e.target.value }))} placeholder="Dia" className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Fechamento</label>
              <input type="number" min={1} max={31} value={form.dia_fechamento}
                onChange={e => setForm(p => ({ ...p, dia_fechamento: e.target.value }))} placeholder="Dia" className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Limite (R$)</label>
              <input inputMode="decimal" value={form.limite}
                onChange={e => setForm(p => ({ ...p, limite: e.target.value }))} placeholder="0,00" className={inputClass} />
            </div>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex gap-2 justify-end">
            {editandoId && (
              <button type="button" onClick={() => { setEditandoId(null); setForm(FORM_VAZIO) }}
                className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-secondary">
                Cancelar edição
              </button>
            )}
            <button type="button" onClick={salvar} disabled={saving}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {saving ? 'Salvando...' : editandoId ? 'Salvar cartão' : 'Adicionar'}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
