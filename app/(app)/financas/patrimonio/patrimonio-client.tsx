'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, TrendingDown, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  TIPOS_CONTA, TIPOS_DIVIDA, formatBRL, formatMesAno, parseBRL,
  type Conta, type Divida, type Fechamento, type TipoConta, type TipoDivida,
} from '@/lib/financas'
import { simularQuitacao } from '@/lib/dividas'
import type { Ptax } from '@/lib/cambio'
import type { CompraDolar } from '@/lib/patrimonio'
import DolarSecao from './dolar-secao'
import Sheet from '../_components/sheet'

interface Props {
  familiaId: string
  userId: string
  contas: Conta[]
  dividas: Divida[]
  compras: CompraDolar[]
  ptax: Ptax | null
  historico: Fechamento[]
  sobraMensal: number
}

type Edicao =
  | { tipo: 'conta'; item: Conta | null }
  | { tipo: 'divida'; item: Divida | null }

const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const texto = (n: number | null | undefined) => (n ? Number(n).toFixed(2).replace('.', ',') : '')

function atualizadoHa(iso: string) {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`
}

export default function PatrimonioClient({ familiaId, userId, contas: contasIniciais, dividas: dividasIniciais, compras: comprasIniciais, ptax, historico, sobraMensal }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()

  const [contas, setContas] = useState(contasIniciais)
  const [dividas, setDividas] = useState(dividasIniciais)
  const [compras, setCompras] = useState(comprasIniciais)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [form, setForm] = useState({ nome: '', tipo: '', saldo: '', juros: '', parcela: '' })
  const [extra, setExtra] = useState(texto(sobraMensal))
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Dólar entra no patrimônio pela PTAX do dia (ou pelo preço médio, se o BC estiver fora)
  const usd = compras.reduce((a, c) => a + Number(c.valor_usd), 0)
  const pagoDolar = compras.reduce((a, c) => a + Number(c.valor_brl), 0)
  const dolarBRL = ptax ? usd * ptax.venda : pagoDolar
  const ativos = contas.reduce((a, c) => a + Number(c.saldo), 0) + dolarBRL
  const passivos = dividas.reduce((a, d) => a + Number(d.saldo), 0)
  const liquido = ativos - passivos
  const anterior = historico.length >= 2 ? historico[historico.length - 2] : null
  const variacao = anterior ? liquido - (Number(anterior.ativos) - Number(anterior.dividas)) : null

  const extraNum = parseBRL(extra) ?? 0
  const avalanche = simularQuitacao(dividas, extraNum, 'avalanche')
  const bolaDeNeve = simularQuitacao(dividas, extraNum, 'bola_de_neve')
  const economia = bolaDeNeve.jurosTotal - avalanche.jurosTotal

  function abrir(e: Edicao) {
    setEdicao(e)
    setErro(null)
    if (e.tipo === 'conta') {
      setForm({ nome: e.item?.nome ?? '', tipo: e.item?.tipo ?? 'conta', saldo: texto(e.item?.saldo), juros: '', parcela: '' })
    } else {
      setForm({
        nome: e.item?.nome ?? '',
        tipo: e.item?.tipo ?? 'cartao',
        saldo: texto(e.item?.saldo),
        juros: e.item?.juros_mensal ? String(e.item.juros_mensal).replace('.', ',') : '',
        parcela: texto(e.item?.parcela),
      })
    }
  }

  async function salvar() {
    if (!edicao) return
    if (!form.nome.trim()) return setErro('Dê um nome.')
    const saldo = parseBRL(form.saldo) ?? 0
    setSaving(true)
    const tabela = edicao.tipo === 'conta' ? 'fin_contas' : 'fin_dividas'
    const base = { nome: form.nome.trim(), tipo: form.tipo, saldo, updated_at: new Date().toISOString() }
    const payload = edicao.tipo === 'conta'
      ? base
      : { ...base, juros_mensal: parseBRL(form.juros) ?? 0, parcela: parseBRL(form.parcela) ?? 0 }
    const query = edicao.item
      ? supabase.from(tabela).update(payload).eq('id', edicao.item.id)
      : supabase.from(tabela).insert({ ...payload, familia_id: familiaId, user_id: userId })
    const { data, error } = await query.select().single()
    setSaving(false)
    if (error || !data) return setErro('Não foi possível salvar.')

    if (edicao.tipo === 'conta') {
      const salvo = data as Conta
      setContas(prev => edicao.item ? prev.map(c => c.id === salvo.id ? salvo : c) : [...prev, salvo])
    } else {
      const salvo = data as Divida
      setDividas(prev => edicao.item ? prev.map(d => d.id === salvo.id ? salvo : d) : [...prev, salvo])
    }
    setEdicao(null)
    startTransition(() => router.refresh())
  }

  async function excluir() {
    if (!edicao?.item || !confirm(`Excluir "${edicao.item.nome}"?`)) return
    const tabela = edicao.tipo === 'conta' ? 'fin_contas' : 'fin_dividas'
    const { error } = await supabase.from(tabela).delete().eq('id', edicao.item.id)
    if (error) return setErro('Não foi possível excluir.')
    if (edicao.tipo === 'conta') setContas(prev => prev.filter(c => c.id !== edicao.item!.id))
    else setDividas(prev => prev.filter(d => d.id !== edicao.item!.id))
    setEdicao(null)
    startTransition(() => router.refresh())
  }

  const maxHist = Math.max(...historico.map(h => Math.abs(Number(h.ativos) - Number(h.dividas))), 1)

  return (
    <div className="space-y-5">
      {/* O placar */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <p className="text-xs text-muted-foreground">Patrimônio líquido · o que temos menos o que devemos</p>
          <p className={`text-3xl font-semibold tabular-nums ${liquido >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatBRL(liquido)}</p>
          {variacao !== null && variacao !== 0 && (
            <p className={`mt-1 flex items-center gap-1 text-xs ${variacao > 0 ? 'text-green-700' : 'text-red-600'}`}>
              {variacao > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {variacao > 0 ? '+' : ''}{formatBRL(variacao)} desde o mês passado
            </p>
          )}
        </div>

        {historico.length >= 2 && (
          <div className="flex h-20 items-center gap-1">
            {historico.map(h => {
              const v = Number(h.ativos) - Number(h.dividas)
              const altura = (Math.abs(v) / maxHist) * 50
              return (
                <div key={h.mes} className="flex h-full flex-1 flex-col" title={`${formatMesAno(new Date(`${h.mes}T12:00:00`))}: ${formatBRL(v)}`}>
                  <div className="flex flex-1 items-end">
                    {v >= 0 && <div className="w-full rounded-t bg-green-600" style={{ height: `${altura * 2}%` }} />}
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex flex-1 items-start">
                    {v < 0 && <div className="w-full rounded-b bg-red-400" style={{ height: `${altura * 2}%` }} />}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {historico.length < 2 && (contas.length > 0 || dividas.length > 0 || compras.length > 0) && (
          <p className="text-xs text-muted-foreground">O histórico se forma sozinho: cada mês em que vocês abrirem o app, o número fica registrado.</p>
        )}
      </div>

      {/* O que temos */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">O que temos <span className="text-muted-foreground font-normal">· {formatBRL(ativos)}</span></h2>
          <button type="button" onClick={() => abrir({ tipo: 'conta', item: null })} className="flex items-center gap-1 text-sm text-primary">
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>
        {contas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Contas, poupança, investimentos, reserva. Mesmo que seja pouco, comece pelo número real.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {contas.map(c => (
              <li key={c.id}>
                <button type="button" onClick={() => abrir({ tipo: 'conta', item: c })} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-secondary/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{TIPOS_CONTA[c.tipo]} · atualizado {atualizadoHa(c.updated_at)}</p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{formatBRL(Number(c.saldo))}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DolarSecao
        familiaId={familiaId}
        userId={userId}
        compras={compras}
        ptax={ptax}
        onChange={novas => { setCompras(novas); startTransition(() => router.refresh()) }}
      />

      {/* O que devemos */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">O que devemos <span className="text-muted-foreground font-normal">· {formatBRL(passivos)}</span></h2>
          <button type="button" onClick={() => abrir({ tipo: 'divida', item: null })} className="flex items-center gap-1 text-sm text-primary">
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>
        {dividas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Saldo devedor total de cada dívida: cartão, cheque especial, empréstimos, financiamentos. Encarar o número é o primeiro passo.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {dividas.map(d => (
              <li key={d.id}>
                <button type="button" onClick={() => abrir({ tipo: 'divida', item: d })} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-secondary/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{d.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {Number(d.juros_mensal) > 0 ? `${String(d.juros_mensal).replace('.', ',')}% ao mês` : 'sem juros informados'}
                      {Number(d.parcela) > 0 && ` · parcela ${formatBRL(Number(d.parcela))}`}
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-red-600">{formatBRL(Number(d.saldo))}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Plano de quitação */}
      {passivos > 0 && (
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-medium">Como sair das dívidas</h2>
            <p className="text-xs text-muted-foreground">Parcelas mínimas em todas, e todo o extra na primeira da fila</p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Extra por mês:</span>
            <div className="relative w-32">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <input
                inputMode="decimal"
                value={extra}
                onChange={e => setExtra(e.target.value)}
                className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {avalanche.meses === null ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              Com esse valor, os juros crescem mais rápido do que os pagamentos e as dívidas nunca acabam. É preciso aumentar o
              extra, renegociar os juros ou informar as parcelas mínimas.
            </p>
          ) : (
            <>
              <div className="rounded-lg bg-green-50 p-4 text-gray-900">
                <p className="text-xs text-green-800">Livres das dívidas em</p>
                <p className="text-xl font-semibold text-green-800">
                  {avalanche.dataLivre && formatMesAno(avalanche.dataLivre)}
                  <span className="ml-2 text-sm font-normal">({avalanche.meses} meses)</span>
                </p>
                <p className="text-xs text-green-800">Juros pagos no caminho: {formatBRL(avalanche.jurosTotal)}</p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Ordem de ataque (maiores juros primeiro)</p>
                <ol className="space-y-1">
                  {avalanche.ordem.map((d, i) => (
                    <li key={d.id} className="flex items-center gap-2 text-sm">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate">{d.nome}</span>
                      <span className="text-xs text-muted-foreground">{String(d.juros_mensal).replace('.', ',')}% a.m.</span>
                    </li>
                  ))}
                </ol>
              </div>

              {economia > 1 && bolaDeNeve.meses !== null && (
                <p className="text-xs text-muted-foreground">
                  Pagando primeiro as menores (bola de neve), vocês terminariam em {bolaDeNeve.meses} meses e pagariam{' '}
                  <strong>{formatBRL(economia)} a mais de juros</strong>. A bola de neve dá vitórias rápidas, mas a ordem acima custa menos.
                </p>
              )}
            </>
          )}
          <p className="text-[11px] text-muted-foreground">
            As parcelas mínimas já devem estar nos gastos fixos. O extra é o que sobra no mês (sugerido pelo orçamento).
          </p>
        </section>
      )}

      {edicao && (
        <Sheet
          titulo={edicao.item ? edicao.item.nome : edicao.tipo === 'conta' ? 'Algo que temos' : 'Uma dívida'}
          onClose={() => setEdicao(null)}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {edicao.tipo === 'conta' ? 'Saldo hoje' : 'Saldo devedor total hoje'}
              </label>
              <div className="flex items-baseline gap-2 border-b-2 border-primary/40 pb-1 focus-within:border-primary">
                <span className="text-xl text-muted-foreground">R$</span>
                <input
                  data-grande
                  inputMode="decimal"
                  value={form.saldo}
                  onChange={e => setForm(p => ({ ...p, saldo: e.target.value }))}
                  placeholder="0,00"
                  className="w-full bg-transparent text-3xl font-semibold tabular-nums focus:outline-none"
                />
              </div>
            </div>

            <input
              value={form.nome}
              onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
              placeholder={edicao.tipo === 'conta' ? 'Nome (ex: Poupança Caixa)' : 'Nome (ex: Rotativo Nubank)'}
              className={inputClass}
            />
            <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} className={inputClass}>
              {Object.entries(edicao.tipo === 'conta' ? TIPOS_CONTA : TIPOS_DIVIDA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            {edicao.tipo === 'divida' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Juros (% ao mês)</label>
                  <input inputMode="decimal" value={form.juros} onChange={e => setForm(p => ({ ...p, juros: e.target.value }))} placeholder="Ex: 12,5" className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Parcela mínima (R$)</label>
                  <input inputMode="decimal" value={form.parcela} onChange={e => setForm(p => ({ ...p, parcela: e.target.value }))} placeholder="0,00" className={inputClass} />
                </div>
                <p className="col-span-2 text-[11px] text-muted-foreground">
                  Os juros estão no contrato, no app do banco ou na fatura (CET). Rotativo do cartão costuma passar de 10% ao mês.
                </p>
              </div>
            )}

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <button
              type="button"
              onClick={salvar}
              disabled={saving}
              className="w-full rounded-lg bg-primary py-3 text-base font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            {edicao.item && (
              <button type="button" onClick={excluir} className="w-full text-sm text-red-600">Excluir</button>
            )}
          </div>
        </Sheet>
      )}
    </div>
  )
}
