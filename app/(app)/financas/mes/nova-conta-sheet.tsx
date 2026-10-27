'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIAS_DESPESA, competenciaISO, formatBRL, formatMesAno, nomeMes, parseBRL } from '@/lib/financas'
import Sheet from '../_components/sheet'

type Tipo = 'mensal' | 'parcelada' | 'unica'

interface Props {
  familiaId: string
  userId: string
  onSaved: (competencia: string) => void // mês do primeiro vencimento
  onClose: () => void
}

const TIPOS: { id: Tipo; label: string }[] = [
  { id: 'mensal', label: 'Todo mês' },
  { id: 'parcelada', label: 'Parcelada' },
  { id: 'unica', label: 'Só uma vez' },
]

/** Conta nova fora do cartão: nome, valor e o próximo vencimento (data completa, sem adivinhar o mês). */
export default function NovaContaSheet({ familiaId, userId, onSaved, onClose }: Props) {
  const supabase = createClient()
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [tipo, setTipo] = useState<Tipo>('mensal')
  const [atual, setAtual] = useState('1')
  const [total, setTotal] = useState('')
  const [categoria, setCategoria] = useState('contas')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const v = parseBRL(valor) ?? 0
  const nAtual = Number(atual) || 1
  const nTotal = Number(total) || 0
  const restantes = Math.max(nTotal - nAtual + 1, 0)
  const ultimo = vencimento && restantes > 0
    ? (() => { const d = new Date(`${vencimento}T12:00:00`); return new Date(d.getFullYear(), d.getMonth() + restantes - 1, 1) })()
    : null

  async function salvar() {
    if (!descricao.trim()) return setErro('Informe o nome da conta.')
    if (!v) return setErro('Informe o valor.')
    if (!vencimento) return setErro('Informe a data do próximo vencimento.')
    if (tipo === 'parcelada' && (nTotal < 1 || nAtual > nTotal)) return setErro('Confira as parcelas: ex. parcela 2 de 5.')
    setSaving(true)
    setErro(null)
    const competencia = competenciaISO(new Date(`${vencimento}T12:00:00`))

    const { error } = tipo === 'unica'
      ? await supabase.from('fin_lancamentos').insert({
          familia_id: familiaId, user_id: userId, data: vencimento, vencimento, competencia, pago: false,
          descricao: descricao.trim(), valor: v, categoria, cartao_id: null, origem: 'manual',
        })
      : await supabase.from('fin_despesas').insert({
          familia_id: familiaId, user_id: userId, descricao: descricao.trim(), categoria, valor: v,
          frequencia: tipo, cartao_id: null, essencial: true, inicio: vencimento,
          dia_vencimento: Number(vencimento.slice(8, 10)),
          parcelas_total: tipo === 'parcelada' ? nTotal : null,
          parcelas_restantes: tipo === 'parcelada' ? restantes : null,
          parcelas_ref: tipo === 'parcelada' ? competencia : null,
        })
    setSaving(false)
    if (error) return setErro(`Não foi possível salvar. (${error.code}: ${error.message})`)
    onSaved(competencia)
  }

  const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <Sheet titulo="Nova conta" onClose={onClose}>
      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Nome</span>
          <input autoFocus value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Energia" className={inputClass} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Valor</span>
            <input inputMode="decimal" value={valor} onChange={e => { setValor(e.target.value); setErro(null) }} placeholder="0,00" className={inputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Próximo vencimento</span>
            <input type="date" value={vencimento} onChange={e => { setVencimento(e.target.value); setErro(null) }} className={inputClass} />
          </label>
        </div>

        <div className="flex gap-2">
          {TIPOS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTipo(t.id)}
              className={`flex-1 rounded-full border px-2 py-2 text-sm ${tipo === t.id ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tipo === 'parcelada' && (
          <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-gray-900">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Esta é a parcela</span>
              <input type="number" min={1} value={atual} onChange={e => setAtual(e.target.value)} className="w-16 rounded-md border border-border bg-background px-2 py-1 text-center" />
              <span>de</span>
              <input type="number" min={1} value={total} onChange={e => setTotal(e.target.value)} placeholder="5" className="w-16 rounded-md border border-border bg-background px-2 py-1 text-center" />
            </div>
            {nTotal > 0 && nAtual <= nTotal && v > 0 && ultimo && (
              <p className="text-xs text-amber-900">
                Faltam {restantes} {restantes === 1 ? 'parcela' : 'parcelas'} = {formatBRL(restantes * v)}. A última em {formatMesAno(ultimo)}.
              </p>
            )}
          </div>
        )}

        {tipo === 'mensal' && vencimento && (
          <p className="text-xs text-muted-foreground">
            Aparece todo mês a partir de {nomeMes(competenciaISO(new Date(`${vencimento}T12:00:00`))).toLowerCase()}, no dia {Number(vencimento.slice(8, 10))}.
            Se o valor variar (como a luz), é só tocar no valor de cada mês.
          </p>
        )}

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Categoria</span>
          <select value={categoria} onChange={e => setCategoria(e.target.value)} className={inputClass}>
            {Object.entries(CATEGORIAS_DESPESA).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </select>
        </label>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="button"
          onClick={salvar}
          disabled={saving}
          className="w-full rounded-lg bg-primary py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Cadastrar'}
        </button>
      </div>
    </Sheet>
  )
}
