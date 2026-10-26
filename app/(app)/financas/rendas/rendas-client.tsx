'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  FREQUENCIA_RENDA_LABEL, MESES, TIPOS_RENDA, formatBRL, parseBRL, rendaMensal,
  type FrequenciaRenda, type Renda, type TipoRenda,
} from '@/lib/financas'

interface Props {
  userId: string
  rendas: Renda[]
}

const FORM_VAZIO = {
  descricao: '',
  tipo: 'salario' as TipoRenda,
  valor: '',
  frequencia: 'mensal' as FrequenciaRenda,
  mes_recebimento: '',
  observacoes: '',
}

const inputClass = 'w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring'

export default function RendasClient({ userId, rendas: initial }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()

  const [rendas, setRendas] = useState(initial)
  const [modalOpen, setModalOpen] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [form, setForm] = useState(FORM_VAZIO)

  const ativas = rendas.filter(r => r.ativo)
  const mediaMensal = rendas.reduce((a, r) => a + rendaMensal(r), 0)
  const fixoMensal = ativas.filter(r => r.frequencia === 'mensal').reduce((a, r) => a + r.valor, 0)
  const eventuais = ativas.filter(r => r.frequencia === 'eventual').reduce((a, r) => a + r.valor, 0)

  // Quanto entra em cada mês do ano: fixo mensal + anuais no mês em que caem
  const porMes = MESES.map((_, i) =>
    fixoMensal + ativas
      .filter(r => r.frequencia === 'anual' && r.mes_recebimento === i + 1)
      .reduce((a, r) => a + r.valor, 0)
  )
  const maiorMes = Math.max(...porMes, 1)
  const anuaisSemMes = ativas.filter(r => r.frequencia === 'anual' && !r.mes_recebimento)

  function abrirNovo() {
    setEditandoId(null)
    setForm(FORM_VAZIO)
    setErro(null)
    setModalOpen(true)
  }

  function abrirEdicao(r: Renda) {
    setEditandoId(r.id)
    setForm({
      descricao: r.descricao,
      tipo: r.tipo,
      valor: r.valor.toFixed(2).replace('.', ','),
      frequencia: r.frequencia,
      mes_recebimento: r.mes_recebimento?.toString() ?? '',
      observacoes: r.observacoes ?? '',
    })
    setErro(null)
    setModalOpen(true)
  }

  function escolherTipo(tipo: TipoRenda) {
    setForm(p => ({
      ...p,
      tipo,
      frequencia: TIPOS_RENDA[tipo].frequenciaPadrao,
      mes_recebimento: tipo === 'decimo_terceiro' && !p.mes_recebimento ? '12' : p.mes_recebimento,
      descricao: p.descricao || TIPOS_RENDA[tipo].label,
    }))
  }

  async function salvar() {
    const valor = parseBRL(form.valor)
    if (!form.descricao.trim()) return setErro('Informe a descrição.')
    if (valor === null) return setErro('Valor inválido. Use o formato 1.234,56.')

    setSaving(true)
    const payload = {
      user_id: userId,
      descricao: form.descricao.trim(),
      tipo: form.tipo,
      valor,
      frequencia: form.frequencia,
      mes_recebimento: form.frequencia === 'anual' && form.mes_recebimento ? Number(form.mes_recebimento) : null,
      observacoes: form.observacoes.trim() || null,
    }

    const query = editandoId
      ? supabase.from('fin_rendas').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editandoId)
      : supabase.from('fin_rendas').insert(payload)
    const { data, error } = await query.select().single()

    setSaving(false)
    if (error || !data) return setErro('Não foi possível salvar. Tente novamente.')

    const salvo = data as Renda
    setRendas(prev => editandoId ? prev.map(r => r.id === editandoId ? salvo : r) : [salvo, ...prev])
    setModalOpen(false)
    startTransition(() => router.refresh())
  }

  async function excluir(r: Renda) {
    if (!confirm(`Excluir "${r.descricao}"?`)) return false
    const anterior = rendas
    setRendas(prev => prev.filter(x => x.id !== r.id))
    const { error } = await supabase.from('fin_rendas').delete().eq('id', r.id)
    if (error) setRendas(anterior)
    else startTransition(() => router.refresh())
    return !error
  }

  async function toggleAtivo(r: Renda) {
    const novo = !r.ativo
    setRendas(prev => prev.map(x => x.id === r.id ? { ...x, ativo: novo } : x))
    const { error } = await supabase.from('fin_rendas').update({ ativo: novo }).eq('id', r.id)
    if (error) setRendas(prev => prev.map(x => x.id === r.id ? { ...x, ativo: !novo } : x))
    else startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Renda média mensal (líquida)</p>
          <p className="text-2xl font-semibold tabular-nums">{formatBRL(mediaMensal)}</p>
          {eventuais > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              + {formatBRL(eventuais)} em rendas eventuais (fora do planejamento)
            </p>
          )}
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova renda
        </button>
      </div>

      {rendas.length === 0 ? (
        <div className="rounded-lg border border-border p-12 text-center space-y-3">
          <Wallet className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Nenhuma renda registrada. Cadastre o salário líquido, o terço de férias e o 13º.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <ul className="divide-y divide-border">
              {rendas.map(r => (
                <li key={r.id} onClick={() => abrirEdicao(r)} className={`flex cursor-pointer items-center gap-3 px-4 py-3 active:bg-secondary/60 sm:cursor-default sm:active:bg-transparent ${r.ativo ? '' : 'opacity-50'}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${r.ativo ? '' : 'line-through'}`}>{r.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {TIPOS_RENDA[r.tipo].label} · {FREQUENCIA_RENDA_LABEL[r.frequencia]}
                      {r.frequencia === 'anual' && r.mes_recebimento && ` · em ${MESES[r.mes_recebimento - 1].toLowerCase()}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums text-green-700">{formatBRL(r.valor)}</p>
                    {r.frequencia === 'anual' && (
                      <p className="text-xs text-muted-foreground tabular-nums">{formatBRL(r.valor / 12)}/mês</p>
                    )}
                  </div>
                  <div className="hidden items-center gap-1 sm:flex" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={r.ativo}
                      onClick={() => toggleAtivo(r)}
                      title={r.ativo ? 'Ativa — clique para pausar' : 'Pausada — clique para reativar'}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors ${r.ativo ? 'bg-primary' : 'bg-input'}`}
                    >
                      <span className={`mt-0.5 inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${r.ativo ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <button type="button" onClick={() => abrirEdicao(r)} className="p-1.5 text-muted-foreground hover:text-foreground" title="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => excluir(r)} className="p-1.5 text-muted-foreground hover:text-red-600" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-medium">Entradas ao longo do ano</h2>
              <p className="text-xs text-muted-foreground">Meses com férias e 13º são oportunidades de poupar ou quitar dívidas</p>
            </div>
            <div className="space-y-1.5">
              {MESES.map((mes, i) => (
                <div key={mes} className="flex items-center gap-3 text-xs">
                  <span className="w-8 text-muted-foreground">{mes.slice(0, 3)}</span>
                  <div className="flex-1 h-4 rounded bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded ${porMes[i] > fixoMensal ? 'bg-green-600' : 'bg-primary/70'}`}
                      style={{ width: `${(porMes[i] / maiorMes) * 100}%` }}
                    />
                  </div>
                  <span className="w-28 text-right tabular-nums">{formatBRL(porMes[i])}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Total no ano: <strong className="text-foreground">{formatBRL(porMes.reduce((a, b) => a + b, 0))}</strong>
              {anuaisSemMes.length > 0 && ` · ${anuaisSemMes.length} renda(s) anual(is) sem mês definido não aparecem no gráfico`}
            </p>
          </div>
        </>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="bg-background rounded-t-2xl sm:rounded-xl border border-border w-full sm:max-w-lg shadow-xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 space-y-5 max-h-[92vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">{editandoId ? 'Editar renda' : 'Nova renda'}</h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={e => escolherTipo(e.target.value as TipoRenda)}
                  className={inputClass}
                >
                  {Object.entries(TIPOS_RENDA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Descrição *</label>
                <input
                  value={form.descricao}
                  onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Ex: Salário TJAM, Salário da esposa"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Valor líquido (R$) *</label>
                  <input
                    inputMode="decimal"
                    value={form.valor}
                    onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                    placeholder="0,00"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Frequência</label>
                  <select
                    value={form.frequencia}
                    onChange={e => setForm(p => ({ ...p, frequencia: e.target.value as FrequenciaRenda }))}
                    className={inputClass}
                  >
                    {Object.entries(FREQUENCIA_RENDA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              {form.frequencia === 'anual' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Mês em que recebe</label>
                  <select
                    value={form.mes_recebimento}
                    onChange={e => setForm(p => ({ ...p, mes_recebimento: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Não sei / varia</option>
                    {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {form.frequencia === 'mensal' && 'Use o valor que cai na conta, já descontados IR, previdência e consignados.'}
                {form.frequencia === 'anual' && 'Rendas anuais entram no planejamento divididas por 12. Se o 13º vem em duas parcelas, cadastre cada uma.'}
                {form.frequencia === 'eventual' && 'Rendas eventuais não entram no orçamento mensal — o ideal é destiná-las direto à poupança.'}
              </p>

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

            {editandoId && (() => {
              const atual = rendas.find(x => x.id === editandoId)
              if (!atual) return null
              return (
                <div className="flex gap-2 sm:hidden">
                  <button
                    type="button"
                    onClick={() => { toggleAtivo(atual); setModalOpen(false) }}
                    className="flex-1 px-3 py-2 rounded-md border border-border text-sm"
                  >
                    {atual.ativo ? 'Pausar renda' : 'Reativar renda'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => { if (await excluir(atual)) setModalOpen(false) }}
                    className="flex-1 px-3 py-2 rounded-md border border-red-200 text-sm text-red-600"
                  >
                    Excluir
                  </button>
                </div>
              )
            })()}

            <div className="flex gap-3 justify-end pt-2 [&>button]:flex-1 sm:[&>button]:flex-none">
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
