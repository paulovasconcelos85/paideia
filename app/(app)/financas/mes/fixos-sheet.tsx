'use client'

import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL, nomeMes, type Cartao, type Despesa, type Lancamento } from '@/lib/financas'
import Sheet from '../_components/sheet'

interface Props {
  familiaId: string
  userId: string
  competencia: string
  pendentes: Despesa[]
  cartoes: Cartao[]
  onSaved: (novos: Lancamento[]) => void
  onClose: () => void
}

export default function FixosSheet({ familiaId, userId, competencia, pendentes, cartoes, onSaved, onClose }: Props) {
  const supabase = createClient()
  // Fixos no cartão costumam chegar pela importação da fatura: começam desmarcados para não duplicar
  const [marcados, setMarcados] = useState(new Set(pendentes.filter(d => !d.cartao_id).map(d => d.id)))
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const total = pendentes.filter(d => marcados.has(d.id)).reduce((a, d) => a + Number(d.valor), 0)
  const nomeCartao = (id: string | null) => cartoes.find(c => c.id === id)?.nome

  function alternar(id: string) {
    setMarcados(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  async function salvar() {
    const escolhidos = pendentes.filter(d => marcados.has(d.id))
    if (escolhidos.length === 0) return onClose()
    setSaving(true)
    const [ano, mes] = competencia.split('-').map(Number)
    const ultimoDia = new Date(ano, mes, 0).getDate()
    const { data, error } = await supabase
      .from('fin_lancamentos')
      .insert(escolhidos.map(d => ({
        familia_id: familiaId,
        user_id: userId,
        data: `${competencia.slice(0, 8)}${String(Math.min(d.dia_vencimento ?? 1, ultimoDia)).padStart(2, '0')}`,
        competencia,
        descricao: d.descricao,
        valor: d.valor,
        categoria: d.categoria,
        cartao_id: d.cartao_id,
        origem: 'fixo',
        despesa_id: d.id,
      })))
      .select()
    setSaving(false)
    if (error || !data) return setErro('Não foi possível lançar os fixos.')
    onSaved(data as Lancamento[])
  }

  return (
    <Sheet titulo={`Fixos de ${nomeMes(competencia).toLowerCase()}`} onClose={onClose}>
      <div className="space-y-4">
        {pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos os gastos fixos deste mês já foram lançados. 👍</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Um toque lança no mês os gastos que se repetem. Desmarque o que ainda não foi pago.
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {pendentes.map(d => (
                <li key={d.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={marcados.has(d.id)}
                      onChange={() => alternar(d.id)}
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{d.descricao}</p>
                      {d.cartao_id && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CreditCard className="h-3 w-3" /> {nomeCartao(d.cartao_id)} (vem na fatura)
                        </p>
                      )}
                    </div>
                    <span className="text-sm tabular-nums">{formatBRL(Number(d.valor))}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        {pendentes.length > 0 && (
          <button
            type="button"
            onClick={salvar}
            disabled={saving || marcados.size === 0}
            className="w-full rounded-lg bg-primary py-3 text-base font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? 'Lançando...' : `Lançar ${marcados.size} · ${formatBRL(total)}`}
          </button>
        )}
      </div>
    </Sheet>
  )
}
