'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TIPOS_RECEITA, competenciaDaReceita, hojeISO, nomeMes, parseBRL,
  type Receita, type TipoReceita,
} from '@/lib/financas'
import Sheet from '../_components/sheet'

interface Props {
  familiaId: string
  userId: string
  receita: Receita | null // null = nova
  inicial?: { tipo: TipoReceita; valor: number; data: string | null; descricao: string } // prevista sendo registrada
  onSaved: (r: Receita) => void
  onDeleted: (id: string) => void
  onClose: () => void
}

/** Uma entrada na conta: quando caiu, quanto e o quê. O mês que ela paga sai da data (dia 15 em diante: o mês seguinte). */
export default function ReceitaSheet({ familiaId, userId, receita, inicial, onSaved, onDeleted, onClose }: Props) {
  const supabase = createClient()
  const [tipo, setTipo] = useState<TipoReceita>(receita?.tipo ?? inicial?.tipo ?? 'decimo_terceiro')
  const [descricao, setDescricao] = useState(receita?.descricao ?? (inicial && inicial.descricao !== TIPOS_RECEITA[inicial.tipo] ? inicial.descricao : ''))
  const [valor, setValor] = useState(receita ? Number(receita.valor).toFixed(2).replace('.', ',') : inicial ? inicial.valor.toFixed(2).replace('.', ',') : '')
  const [data, setData] = useState(receita?.data ?? inicial?.data ?? hojeISO())
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const competencia = data ? competenciaDaReceita(data) : null

  async function salvar() {
    const v = parseBRL(valor)
    if (v === null) return setErro('Informe o valor.')
    if (!data || !competencia) return setErro('Informe a data.')
    setSaving(true)
    const dados = { tipo, descricao: descricao.trim() || null, valor: v, data, competencia }
    const { data: salvo, error } = receita
      ? await supabase.from('fin_receitas').update(dados).eq('id', receita.id).select().single()
      : await supabase.from('fin_receitas').insert({ ...dados, familia_id: familiaId, user_id: userId }).select().single()
    setSaving(false)
    if (error || !salvo) return setErro(`Não foi possível salvar.${error ? ` (${error.code}: ${error.message})` : ''}`)
    onSaved(salvo as Receita)
  }

  async function excluir() {
    if (!receita || !confirm('Excluir esta entrada?')) return
    const { error } = await supabase.from('fin_receitas').delete().eq('id', receita.id)
    if (error) return setErro(`Não foi possível excluir. (${error.code}: ${error.message})`)
    onDeleted(receita.id)
  }

  const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <Sheet titulo={receita ? 'Entrada' : 'Nova entrada'} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TIPOS_RECEITA) as TipoReceita[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`rounded-full border px-3 py-1.5 text-sm ${tipo === t ? 'border-blue-400 bg-blue-50 font-medium text-blue-800' : 'border-border'}`}
            >
              {TIPOS_RECEITA[t]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Valor</span>
            <input inputMode="decimal" autoFocus={!receita} value={valor} onChange={e => { setValor(e.target.value); setErro(null) }} placeholder="0,00" className={inputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Caiu em</span>
            <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputClass} />
          </label>
        </div>
        {competencia && (
          <p className="text-xs text-muted-foreground">
            {tipo === 'saldo' ? 'Fica registrado, mas não conta como renda nem para o dízimo.' : `Paga as contas de ${nomeMes(competencia).toLowerCase()}.`}
          </p>
        )}

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Descrição (opcional)</span>
          <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder={TIPOS_RECEITA[tipo]} className={inputClass} />
        </label>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="button"
          onClick={salvar}
          disabled={saving}
          className="w-full rounded-lg bg-blue-600 py-3 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        {receita && (
          <button type="button" onClick={excluir} className="w-full text-sm text-muted-foreground hover:text-red-600">
            Excluir entrada
          </button>
        )}
      </div>
    </Sheet>
  )
}
