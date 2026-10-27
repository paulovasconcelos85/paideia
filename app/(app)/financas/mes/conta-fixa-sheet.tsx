'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIAS_DESPESA, parseBRL, type Despesa } from '@/lib/financas'
import Sheet from '../_components/sheet'

// Minhas contas do mês, fora do cartão: um toque preenche nome e categoria
export interface Atalho {
  nome: string
  categoria: string
  busca: string[] // termos que indicam que a conta já está cadastrada
  mae?: boolean
}

export const ATALHOS: Atalho[] = [
  { nome: 'Financiamento da casa', categoria: 'moradia', busca: ['financiamento'] },
  { nome: 'Energia elétrica', categoria: 'contas', busca: ['energia', 'luz'] },
  { nome: 'Internet', categoria: 'contas', busca: ['internet'] },
  { nome: 'Condomínio', categoria: 'moradia', busca: ['condominio'] },
  { nome: 'Plano de saúde', categoria: 'saude', busca: ['plano de saude'] },
  { nome: 'IPTU', categoria: 'moradia', busca: ['iptu'] },
  { nome: 'IPVA', categoria: 'impostos', busca: ['ipva'] },
  { nome: 'Condomínio da mãe', categoria: 'moradia', busca: ['condominio'], mae: true },
  { nome: 'Internet da mãe', categoria: 'contas', busca: ['internet'], mae: true },
  { nome: 'FIAP', categoria: 'educacao', busca: ['fiap'] },
]

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Atalhos que ainda não têm conta fixa cadastrada. */
export function atalhosPendentes(despesas: Despesa[]): Atalho[] {
  const nomes = despesas.filter(d => d.ativo && d.frequencia === 'mensal').map(d => normalizar(d.descricao))
  return ATALHOS.filter(a => !nomes.some(n => a.busca.some(b => n.includes(b)) && (a.mae ? n.includes('mae') : !n.includes('mae'))))
}

interface Props {
  familiaId: string
  userId: string
  atalho: Atalho | null
  pendentes: Atalho[]
  onSaved: () => void
  onClose: () => void
}

export default function ContaFixaSheet({ familiaId, userId, atalho, pendentes, onSaved, onClose }: Props) {
  const supabase = createClient()
  const [descricao, setDescricao] = useState(atalho?.nome ?? '')
  const [categoria, setCategoria] = useState(atalho?.categoria ?? 'contas')
  const [valor, setValor] = useState('')
  const [dia, setDia] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function escolher(a: Atalho) {
    setDescricao(a.nome)
    setCategoria(a.categoria)
  }

  async function salvar() {
    const v = parseBRL(valor)
    const d = Number(dia)
    if (!descricao.trim()) return setErro('Informe o nome da conta.')
    if (!v) return setErro('Informe o valor de cada mês (se varia, use a média).')
    if (!d || d < 1 || d > 31) return setErro('Informe o dia do vencimento (1 a 31).')
    setSaving(true)
    const { error } = await supabase.from('fin_despesas').insert({
      familia_id: familiaId,
      user_id: userId,
      descricao: descricao.trim(),
      categoria,
      valor: v,
      frequencia: 'mensal',
      dia_vencimento: d,
      cartao_id: null,
      essencial: true,
    })
    setSaving(false)
    if (error) return setErro(`Não foi possível salvar. (${error.code}: ${error.message})`)
    onSaved()
  }

  const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <Sheet titulo="Nova conta do mês" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Conta que pago todo mês fora do cartão. Ela aparece em Contas do mês, com o vencimento, até eu marcar como paga.
        </p>

        {pendentes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendentes.map(a => (
              <button
                key={a.nome}
                type="button"
                onClick={() => escolher(a)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  descricao === a.nome ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border hover:bg-secondary'
                }`}
              >
                {a.nome}
              </button>
            ))}
          </div>
        )}

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Nome</span>
          <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Energia elétrica" className={inputClass} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Valor por mês</span>
            <input inputMode="decimal" value={valor} onChange={e => { setValor(e.target.value); setErro(null) }} placeholder="0,00" className={inputClass} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Vence todo dia</span>
            <input type="number" min={1} max={31} value={dia} onChange={e => { setDia(e.target.value); setErro(null) }} placeholder="10" className={inputClass} />
          </label>
        </div>

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
          {saving ? 'Salvando...' : 'Cadastrar conta'}
        </button>
      </div>
    </Sheet>
  )
}
