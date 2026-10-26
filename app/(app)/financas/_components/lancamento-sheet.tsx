'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, CreditCard, Hourglass } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  CATEGORIAS_DESPESA, CATEGORIAS_SUPERFLUAS, competenciaISO, formatBRL, formatMesAno, fraseCustoEmTempo, hojeISO, parseBRL,
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
  cartaoPadrao?: string // abrir já num cartão (ex.: a partir do bloco do cartão)
  onSaved: (l: Lancamento) => void
  onDeleted?: (id: string) => void
  onClose: () => void
}

type Tipo = 'avulso' | 'parcelado' | 'mensal'

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
  familiaId, userId, cartoes, planoPrincipal, rendaMensal, lancamento, cartaoPadrao, onSaved, onDeleted, onClose,
}: Props) {
  const supabase = createClient()
  const [valor, setValor] = useState(lancamento ? Number(lancamento.valor).toFixed(2).replace('.', ',') : '')
  const [categoria, setCategoria] = useState(lancamento?.categoria ?? 'alimentacao')
  const [cartaoId, setCartaoId] = useState<string>(lancamento?.cartao_id ?? cartaoPadrao ?? '')
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? '')
  const [data, setData] = useState(lancamento?.data ?? hojeISO())
  const [todasCategorias, setTodasCategorias] = useState(!CATEGORIAS_RAPIDAS.includes(lancamento?.categoria ?? 'alimentacao'))
  // Essencial: segue a categoria até a pessoa marcar à mão
  const [essencialManual, setEssencialManual] = useState<boolean | null>(lancamento?.essencial ?? null)
  const [tipo, setTipo] = useState<Tipo>(
    lancamento?.parcelas_total ? 'parcelado' : lancamento?.despesa_id ? 'mensal' : 'avulso'
  )
  const [parcelaAtual, setParcelaAtual] = useState(lancamento?.parcela_atual?.toString() ?? '1')
  const [parcelasTotal, setParcelasTotal] = useState(lancamento?.parcelas_total?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Lançamento em sequência: depois de salvar, a janela fica pronta para o próximo
  const [salvos, setSalvos] = useState<{ ultimo: string; valor: number; total: number } | null>(null)
  const valorRef = useRef<HTMLInputElement>(null)

  const jaNoOrcamento = !!lancamento?.despesa_id

  // Lançamento novo: começa no cartão indicado ou no último meio de pagamento usado
  useEffect(() => {
    if (lancamento || cartaoPadrao) return
    try {
      const ultimo = localStorage.getItem(ULTIMO_PAGAMENTO_KEY)
      if (ultimo === '' || cartoes.some(c => c.id === ultimo)) setCartaoId(ultimo ?? '')
      else if (cartoes[0]) setCartaoId(cartoes[0].id)
    } catch {
      if (cartoes[0]) setCartaoId(cartoes[0].id)
    }
  }, [lancamento, cartaoPadrao, cartoes])

  const valorNum = parseBRL(valor) ?? 0
  const essencial = essencialManual ?? !CATEGORIAS_SUPERFLUAS.has(categoria)
  const custo = !essencial ? fraseCustoEmTempo(valorNum, planoPrincipal, rendaMensal) : null
  const categorias = todasCategorias ? Object.keys(CATEGORIAS_DESPESA) : CATEGORIAS_RAPIDAS

  const total = Number(parcelasTotal) || 0
  const atual = Number(parcelaAtual) || 1
  const restantes = Math.max(total - atual + 1, 0)

  async function salvar() {
    if (!valorNum) return setErro('Informe o valor.')
    if (tipo === 'parcelado' && (total < 2 || atual > total)) return setErro('Confira as parcelas: ex. parcela 3 de 10.')
    setSaving(true)
    setErro(null)

    const cartao = cartoes.find(c => c.id === cartaoId) ?? null
    const competencia = competenciaDoGasto(data, cartao)
    const desc = descricao.trim() || CATEGORIAS_DESPESA[categoria].label

    // Parcelado ou "todo mês" entra no orçamento, para o "quanto falta" e a projeção ficarem certos
    let despesaId = lancamento?.despesa_id ?? null
    const precisaOrcamento = !despesaId && (tipo === 'mensal' || (tipo === 'parcelado' && total > atual))
    if (precisaOrcamento) {
      const { data: despesa, error } = await supabase
        .from('fin_despesas')
        .insert({
          familia_id: familiaId,
          user_id: userId,
          descricao: desc,
          categoria,
          valor: valorNum,
          frequencia: tipo === 'mensal' ? 'mensal' : 'parcelada',
          parcelas_total: tipo === 'parcelado' ? total : null,
          parcelas_restantes: tipo === 'parcelado' ? restantes : null,
          parcelas_ref: tipo === 'parcelado' ? competencia : null,
          cartao_id: cartaoId || null,
          dia_vencimento: !cartaoId ? new Date(`${data}T12:00:00`).getDate() : null,
          essencial,
        })
        .select('id')
        .single()
      if (error || !despesa) {
        setSaving(false)
        return setErro(`Não foi possível incluir no orçamento.${error ? ` (${error.code}: ${error.message})` : ''}`)
      }
      despesaId = despesa.id
    }

    // Já ligado ao orçamento: a correção feita aqui vale lá também
    if (lancamento?.despesa_id) {
      const { error } = await supabase
        .from('fin_despesas')
        .update({
          descricao: desc,
          categoria,
          essencial,
          cartao_id: cartaoId || null,
          ...(tipo === 'parcelado' ? { parcelas_total: total, parcelas_restantes: restantes, parcelas_ref: competencia } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', lancamento.despesa_id)
      if (error) {
        setSaving(false)
        return setErro(`Não foi possível atualizar o orçamento. (${error.code}: ${error.message})`)
      }
    }

    const payload = {
      familia_id: familiaId,
      user_id: lancamento?.user_id ?? userId,
      valor: valorNum,
      categoria,
      cartao_id: cartaoId || null,
      descricao: desc,
      data,
      competencia,
      essencial,
      parcela_atual: tipo === 'parcelado' ? atual : null,
      parcelas_total: tipo === 'parcelado' ? total : null,
      despesa_id: despesaId,
    }
    const query = lancamento
      ? supabase.from('fin_lancamentos').update(payload).eq('id', lancamento.id)
      : supabase.from('fin_lancamentos').insert(payload)
    const { data: salvo, error } = await query.select().single()
    setSaving(false)
    if (error || !salvo) return setErro(`Não foi possível salvar.${error ? ` (${error.code}: ${error.message})` : ''}`)
    try { localStorage.setItem(ULTIMO_PAGAMENTO_KEY, cartaoId) } catch { /* ignorado */ }
    onSaved(salvo as Lancamento)
    if (lancamento) return

    // Mantém cartão, categoria e data; limpa o resto para o próximo
    setSalvos(prev => ({ ultimo: desc, valor: valorNum, total: (prev?.total ?? 0) + 1 }))
    setValor('')
    setDescricao('')
    setTipo('avulso')
    setEssencialManual(null)
    setParcelaAtual('1')
    setParcelasTotal('')
    valorRef.current?.focus()
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
        {salvos && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span className="min-w-0 flex-1 truncate">{salvos.ultimo} · {formatBRL(salvos.valor)}</span>
            <span className="whitespace-nowrap text-xs">{salvos.total} {salvos.total === 1 ? 'lançado' : 'lançados'}</span>
          </div>
        )}

        <div>
          <div className="flex items-baseline gap-2 border-b-2 border-primary/40 pb-1 focus-within:border-primary">
            <span className="text-2xl text-muted-foreground">R$</span>
            <input
              inputMode="decimal"
              value={valor}
              onChange={e => { setValor(e.target.value); setErro(null) }}
              placeholder="0,00"
              ref={valorRef}
              autoFocus={!lancamento}
              data-grande
              className="w-full bg-transparent text-4xl font-semibold tabular-nums focus:outline-none"
            />
          </div>
          {tipo === 'parcelado' && <p className="mt-1 text-xs text-muted-foreground">valor de cada parcela</p>}
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

        {/* Detalhes: essencial e se é parcelado ou se repete */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEssencialManual(!essencial)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                essencial ? 'border-green-300 bg-green-50 text-green-800' : 'border-amber-300 bg-amber-50 text-amber-800'
              }`}
            >
              {essencial ? '✓ Essencial' : 'Não essencial'}
            </button>
            <button type="button" onClick={() => setTipo(tipo === 'parcelado' ? 'avulso' : 'parcelado')} className={chip(tipo === 'parcelado')}>
              Parcelado
            </button>
            <button type="button" onClick={() => setTipo(tipo === 'mensal' ? 'avulso' : 'mensal')} className={chip(tipo === 'mensal')}>
              Todo mês
            </button>
          </div>

          {tipo === 'parcelado' && (
            <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-gray-900">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>Parcela</span>
                <input
                  type="number"
                  min={1}
                  value={parcelaAtual}
                  onChange={e => setParcelaAtual(e.target.value)}
                  className="w-16 rounded-md border border-border bg-background px-2 py-1 text-center text-sm"
                />
                <span>de</span>
                <input
                  type="number"
                  min={2}
                  value={parcelasTotal}
                  onChange={e => setParcelasTotal(e.target.value)}
                  placeholder="10"
                  className="w-16 rounded-md border border-border bg-background px-2 py-1 text-center text-sm"
                />
              </div>
              {total >= 2 && atual <= total && valorNum > 0 && (
                <p className="text-xs text-amber-900">
                  {restantes > 1
                    ? <>Com esta, faltam <strong>{restantes} parcelas = {formatBRL(restantes * valorNum)}</strong>, a última em {formatMesAno(new Date(new Date().getFullYear(), new Date().getMonth() + restantes - 1, 1))}.</>
                    : 'Última parcela.'}
                </p>
              )}
            </div>
          )}

          {jaNoOrcamento ? (
            <p className="text-xs text-muted-foreground">✓ Já acompanhado no orçamento (Orçamento → Gastos fixos).</p>
          ) : tipo === 'parcelado' && total > atual ? (
            <p className="text-xs text-muted-foreground">As parcelas que faltam entram no orçamento, para acompanhar o &quot;quanto falta&quot;.</p>
          ) : tipo === 'mensal' ? (
            <p className="text-xs text-muted-foreground">Entra também nos gastos fixos do orçamento, para os próximos meses.</p>
          ) : null}
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="button"
          onClick={salvar}
          disabled={saving}
          className="w-full rounded-lg bg-primary py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : lancamento ? 'Salvar' : salvos ? 'Lançar outro' : 'Lançar'}
        </button>

        {salvos && !lancamento && (
          <button type="button" onClick={onClose} className="w-full rounded-lg border border-primary py-3 text-base font-medium text-primary">
            Concluir
          </button>
        )}

        {lancamento && onDeleted && (
          <button type="button" onClick={excluir} className="w-full text-sm text-red-600">
            Excluir lançamento
          </button>
        )}
      </div>
    </Sheet>
  )
}
