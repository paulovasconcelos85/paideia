'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  CATEGORIAS_DESPESA, FREQUENCIA_DESPESA_LABEL, despesaMensal, formatBRL, parseBRL,
  type Despesa, type FrequenciaDespesa,
} from '@/lib/financas'

interface Props {
  userId: string
  despesas: Despesa[]
}

const FORM_VAZIO = {
  descricao: '',
  categoria: 'moradia',
  valor: '',
  frequencia: 'mensal' as FrequenciaDespesa,
  parcelas_restantes: '',
  dia_vencimento: '',
  essencial: true,
  observacoes: '',
}

const inputClass = 'w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring'

export default function GastosClient({ userId, despesas: initial }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()

  const [despesas, setDespesas] = useState(initial)
  const [modalOpen, setModalOpen] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [form, setForm] = useState(FORM_VAZIO)

  const total = despesas.reduce((a, d) => a + despesaMensal(d), 0)

  const grupos = Object.keys(CATEGORIAS_DESPESA)
    .map(cat => ({
      cat,
      itens: despesas.filter(d => d.categoria === cat),
    }))
    .filter(g => g.itens.length > 0)

  function abrirNovo() {
    setEditandoId(null)
    setForm(FORM_VAZIO)
    setErro(null)
    setModalOpen(true)
  }

  function abrirEdicao(d: Despesa) {
    setEditandoId(d.id)
    setForm({
      descricao: d.descricao,
      categoria: d.categoria,
      valor: d.valor.toFixed(2).replace('.', ','),
      frequencia: d.frequencia,
      parcelas_restantes: d.parcelas_restantes?.toString() ?? '',
      dia_vencimento: d.dia_vencimento?.toString() ?? '',
      essencial: d.essencial,
      observacoes: d.observacoes ?? '',
    })
    setErro(null)
    setModalOpen(true)
  }

  async function salvar() {
    const valor = parseBRL(form.valor)
    if (!form.descricao.trim()) return setErro('Informe a descrição.')
    if (valor === null) return setErro('Valor inválido. Use o formato 1.234,56.')

    setSaving(true)
    const payload = {
      user_id: userId,
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      valor,
      frequencia: form.frequencia,
      parcelas_restantes: form.frequencia === 'parcelada' && form.parcelas_restantes ? Number(form.parcelas_restantes) : null,
      dia_vencimento: form.dia_vencimento ? Number(form.dia_vencimento) : null,
      essencial: form.essencial,
      observacoes: form.observacoes.trim() || null,
    }

    const query = editandoId
      ? supabase.from('fin_despesas').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editandoId)
      : supabase.from('fin_despesas').insert(payload)
    const { data, error } = await query.select().single()

    setSaving(false)
    if (error || !data) return setErro('Não foi possível salvar. Tente novamente.')

    const salvo = data as Despesa
    setDespesas(prev => editandoId ? prev.map(d => d.id === editandoId ? salvo : d) : [salvo, ...prev])
    setModalOpen(false)
    startTransition(() => router.refresh())
  }

  async function excluir(d: Despesa) {
    if (!confirm(`Excluir "${d.descricao}"?`)) return
    const anterior = despesas
    setDespesas(prev => prev.filter(x => x.id !== d.id))
    const { error } = await supabase.from('fin_despesas').delete().eq('id', d.id)
    if (error) setDespesas(anterior)
    else startTransition(() => router.refresh())
  }

  async function toggleAtivo(d: Despesa) {
    const novo = !d.ativo
    setDespesas(prev => prev.map(x => x.id === d.id ? { ...x, ativo: novo } : x))
    const { error } = await supabase.from('fin_despesas').update({ ativo: novo }).eq('id', d.id)
    if (error) setDespesas(prev => prev.map(x => x.id === d.id ? { ...x, ativo: !novo } : x))
    else startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Custo mensal da família</p>
          <p className="text-2xl font-semibold tabular-nums">{formatBRL(total)}</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo gasto
        </button>
      </div>

      {despesas.length === 0 ? (
        <div className="rounded-lg border border-border p-12 text-center space-y-3">
          <Receipt className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Nenhum gasto registrado. Comece pelos fixos: aluguel, contas, escola, plano de saúde, cartão.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map(({ cat, itens }) => {
            const subtotal = itens.reduce((a, d) => a + despesaMensal(d), 0)
            return (
              <div key={cat} className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/50 border-b border-border">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${CATEGORIAS_DESPESA[cat].className}`}>
                    {CATEGORIAS_DESPESA[cat].label}
                  </span>
                  <span className="text-sm font-medium tabular-nums">{formatBRL(subtotal)}</span>
                </div>
                <ul className="divide-y divide-border">
                  {itens.map(d => (
                    <li key={d.id} className={`flex items-center gap-3 px-4 py-3 ${d.ativo ? '' : 'opacity-50'}`}>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${d.ativo ? '' : 'line-through'}`}>{d.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {FREQUENCIA_DESPESA_LABEL[d.frequencia]}
                          {d.frequencia === 'parcelada' && d.parcelas_restantes !== null && ` · ${d.parcelas_restantes} restantes`}
                          {d.dia_vencimento && ` · vence dia ${d.dia_vencimento}`}
                          {!d.essencial && ' · não essencial'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">{formatBRL(d.valor)}</p>
                        {d.frequencia === 'anual' && (
                          <p className="text-xs text-muted-foreground tabular-nums">{formatBRL(d.valor / 12)}/mês</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={d.ativo}
                          onClick={() => toggleAtivo(d)}
                          title={d.ativo ? 'Ativo — clique para pausar' : 'Pausado — clique para reativar'}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors ${d.ativo ? 'bg-primary' : 'bg-input'}`}
                        >
                          <span className={`mt-0.5 inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${d.ativo ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                        <button type="button" onClick={() => abrirEdicao(d)} className="p-1.5 text-muted-foreground hover:text-foreground" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => excluir(d)} className="p-1.5 text-muted-foreground hover:text-red-600" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="bg-background rounded-xl border border-border w-full max-w-lg shadow-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">{editandoId ? 'Editar gasto' : 'Novo gasto'}</h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Descrição *</label>
                <input
                  value={form.descricao}
                  onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Ex: Aluguel, Energia, Escola das crianças"
                  className={inputClass}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Valor (R$) *</label>
                  <input
                    inputMode="decimal"
                    value={form.valor}
                    onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                    placeholder="0,00"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Categoria</label>
                  <select
                    value={form.categoria}
                    onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
                    className={inputClass}
                  >
                    {Object.entries(CATEGORIAS_DESPESA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Frequência</label>
                  <select
                    value={form.frequencia}
                    onChange={e => setForm(p => ({ ...p, frequencia: e.target.value as FrequenciaDespesa }))}
                    className={inputClass}
                  >
                    {Object.entries(FREQUENCIA_DESPESA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {form.frequencia === 'parcelada' ? (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Parcelas restantes</label>
                    <input
                      type="number"
                      min={0}
                      value={form.parcelas_restantes}
                      onChange={e => setForm(p => ({ ...p, parcelas_restantes: e.target.value }))}
                      placeholder="Ex: 8"
                      className={inputClass}
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Dia do vencimento</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={form.dia_vencimento}
                      onChange={e => setForm(p => ({ ...p, dia_vencimento: e.target.value }))}
                      placeholder="Ex: 10"
                      className={inputClass}
                    />
                  </div>
                )}
              </div>

              {form.frequencia === 'anual' && (
                <p className="text-xs text-muted-foreground">
                  Gastos anuais (IPVA, IPTU, seguro, material escolar) são diluídos em 12 no planejamento mensal.
                </p>
              )}

              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.essencial}
                  onClick={() => setForm(p => ({ ...p, essencial: !p.essencial }))}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors ${form.essencial ? 'bg-primary' : 'bg-input'}`}
                >
                  <span className={`mt-0.5 inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.essencial ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{form.essencial ? 'Essencial' : 'Não essencial'}</p>
                  <p className="text-xs text-muted-foreground">
                    {form.essencial ? 'A família não vive sem' : 'Dá para cortar ou reduzir se precisar'}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Observações</label>
                <textarea
                  rows={2}
                  value={form.observacoes}
                  onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                  className={inputClass}
                />
              </div>

              {erro && <p className="text-sm text-red-600">{erro}</p>}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={saving}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
