'use client'

import { useEffect, useState } from 'react'
import { CreditCard, Hourglass } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  CATEGORIAS_DESPESA, CATEGORIAS_SUPERFLUAS, competenciaISO, fraseCustoEmTempo, hojeISO, parseBRL,
  type Cartao, type Lancamento, type Plano,
} from '@/lib/financas'
import Sheet from './sheet'

interface Props {
  familiaId: string
  userId: string
  cartoes: Cartao[]
  planoPrincipal: Plano | null
  rendaMensal: number
  lancamento?: Lancamento | null
  onSaved: (l: Lancamento) => void
  onDeleted?: (id: string) => void
  onClose: () => void
}

export const ULTIMO_PAGAMENTO_KEY = 'ekos:ultimo-pagamento'

// As mais usadas no dia a dia aparecem primeiro; o resto fica em "mais"
const CATEGORIAS_RAPIDAS = ['alimentacao', 'transporte', 'lazer', 'saude', 'filhos', 'pessoal', 'contas', 'outros']

/** No cartão, compras depois do fechamento caem na fatura do mês seguinte. */
export function competenciaDoGasto(dataISO: string, cartao?: Cartao | null): string {
  const data = new Date(`${dataISO}T12:00:00`)
  if (cartao?.dia_fechamento && data.getDate() >= cartao.dia_fechamento) {
    return competenciaISO(new Date(data.getFullYear(), data.getMonth() + 1, 1))
  }
  return competenciaISO(data)
}

export default function LancamentoSheet({
  familiaId, userId, cartoes, planoPrincipal, rendaMensal, lancamento, onSaved, onDeleted, onClose,
}: Props) {
  const supabase = createClient()
  const [valor, setValor] = useState(lancamento ? Number(lancamento.valor).toFixed(2).replace('.', ',') : '')
  const [categoria, setCategoria] = useState(lancamento?.categoria ?? 'alimentacao')
  const [cartaoId, setCartaoId] = useState<string>(lancamento?.cartao_id ?? '')
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? '')
  const [data, setData] = useState(lancamento?.data ?? hojeISO())
  const [todasCategorias, setTodasCategorias] = useState(!CATEGORIAS_RAPIDAS.includes(lancamento?.categoria ?? 'alimentacao'))
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Lançamento novo: começa no último meio de pagamento usado (quase sempre o cartão)
  useEffect(() => {
    if (lancamento) return
    try {
      const ultimo = localStorage.getItem(ULTIMO_PAGAMENTO_KEY)
      if (ultimo === '' || cartoes.some(c => c.id === ultimo)) setCartaoId(ultimo ?? '')
      else if (cartoes[0]) setCartaoId(cartoes[0].id)
    } catch {
      if (cartoes[0]) setCartaoId(cartoes[0].id)
    }
  }, [lancamento, cartoes])

  const valorNum = parseBRL(valor) ?? 0
  const custo = CATEGORIAS_SUPERFLUAS.has(categoria) ? fraseCustoEmTempo(valorNum, planoPrincipal, rendaMensal) : null
  const categorias = todasCategorias ? Object.keys(CATEGORIAS_DESPESA) : CATEGORIAS_RAPIDAS

  async function salvar() {
    if (!valorNum) return setErro('Informe o valor.')
    setSaving(true)
    const cartao = cartoes.find(c => c.id === cartaoId) ?? null
    const payload = {
      familia_id: familiaId,
      user_id: lancamento?.user_id ?? userId,
      valor: valorNum,
      categoria,
      cartao_id: cartaoId || null,
      descricao: descricao.trim() || CATEGORIAS_DESPESA[categoria].label,
      data,
      competencia: competenciaDoGasto(data, cartao),
    }
    const query = lancamento
      ? supabase.from('fin_lancamentos').update(payload).eq('id', lancamento.id)
      : supabase.from('fin_lancamentos').insert(payload)
    const { data: salvo, error } = await query.select().single()
    setSaving(false)
    if (error || !salvo) return setErro('Não foi possível salvar. Tente de novo.')
    try { localStorage.setItem(ULTIMO_PAGAMENTO_KEY, cartaoId) } catch { /* ignorado */ }
    onSaved(salvo as Lancamento)
  }

  async function excluir() {
    if (!lancamento || !confirm('Excluir este lançamento?')) return
    const { error } = await supabase.from('fin_lancamentos').delete().eq('id', lancamento.id)
    if (!error) onDeleted?.(lancamento.id)
  }

  const chip = (ativo: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm transition-colors ${
      ativo ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border hover:bg-secondary'
    }`

  return (
    <Sheet titulo={lancamento ? 'Editar lançamento' : 'Quanto foi?'} onClose={onClose}>
      <div className="space-y-5">
        <div>
          <div className="flex items-baseline gap-2 border-b-2 border-primary/40 pb-1 focus-within:border-primary">
            <span className="text-2xl text-muted-foreground">R$</span>
            <input
              inputMode="decimal"
              value={valor}
              onChange={e => { setValor(e.target.value); setErro(null) }}
              placeholder="0,00"
              autoFocus={!lancamento}
              data-grande
              className="w-full bg-transparent text-4xl font-semibold tabular-nums focus:outline-none"
            />
          </div>
          {custo && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
              <Hourglass className="h-3.5 w-3.5 flex-shrink-0" /> {custo}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Com o quê?</p>
          <div className="flex flex-wrap gap-2">
            {categorias.map(c => (
              <button key={c} type="button" onClick={() => setCategoria(c)} className={chip(categoria === c)}>
                {CATEGORIAS_DESPESA[c].label}
              </button>
            ))}
            {!todasCategorias && (
              <button type="button" onClick={() => setTodasCategorias(true)} className="px-2 text-sm text-primary">
                mais…
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Pago com</p>
          <div className="flex flex-wrap gap-2">
            {cartoes.map(c => (
              <button key={c.id} type="button" onClick={() => setCartaoId(c.id)} className={`flex items-center gap-1.5 ${chip(cartaoId === c.id)}`}>
                <CreditCard className="h-3.5 w-3.5" /> {c.nome}
              </button>
            ))}
            <button type="button" onClick={() => setCartaoId('')} className={chip(cartaoId === '')}>
              Pix / débito
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <input
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder={`Descrição (opcional): ${CATEGORIAS_DESPESA[categoria].label}`}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="date"
            value={data}
            onChange={e => setData(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="button"
          onClick={salvar}
          disabled={saving}
          className="w-full rounded-lg bg-primary py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Lançar'}
        </button>

        {lancamento && onDeleted && (
          <button type="button" onClick={excluir} className="w-full text-sm text-red-600">
            Excluir lançamento
          </button>
        )}
      </div>
    </Sheet>
  )
}
