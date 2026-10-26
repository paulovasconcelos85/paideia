'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Plus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  STATUS_PLANO, formatBRL, formatMesAno, formatMoeda, parseBRL, projetarPlano,
  type EtapaPlano, type Moeda, type Plano, type StatusPlano,
} from '@/lib/financas'

interface Props {
  plano: Plano
  saldoMensal: number
  aportesOutros: number // aportes de outros planos ativos, que disputam a mesma sobra
}

const inputClass = 'w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const valorTexto = (n: number | null) => (n ? Number(n).toFixed(2).replace('.', ',') : '')

export default function PlanoDetalhe({ plano, saldoMensal, aportesOutros }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    titulo: plano.titulo,
    descricao: plano.descricao ?? '',
    status: plano.status,
    moeda: plano.moeda,
    cotacao: plano.cotacao ? String(plano.cotacao).replace('.', ',') : '',
    valor_guardado: valorTexto(plano.valor_guardado),
    aporte_mensal: Number(plano.aporte_mensal),
    data_alvo: plano.data_alvo ?? '',
  })
  const [itens, setItens] = useState(plano.itens.map(i => ({ descricao: i.descricao, valor: valorTexto(i.valor) })))
  const [etapas, setEtapas] = useState<EtapaPlano[]>(plano.etapas)
  const [novaEtapa, setNovaEtapa] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  function alterar<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm(p => ({ ...p, [campo]: valor }))
    setDirty(true)
    setMsg(null)
  }

  // Plano "ao vivo", refletindo o que está no formulário, para o simulador
  const atual: Plano = useMemo(() => ({
    ...plano,
    moeda: form.moeda,
    cotacao: parseBRL(form.cotacao),
    valor_guardado: parseBRL(form.valor_guardado) ?? 0,
    aporte_mensal: form.aporte_mensal,
    data_alvo: form.data_alvo || null,
    itens: itens.map(i => ({ descricao: i.descricao, valor: parseBRL(i.valor) ?? 0 })),
  }), [plano, form, itens])

  const pr = projetarPlano(atual)
  const disponivel = Math.max(saldoMensal - aportesOutros, 0)
  const maxSlider = Math.max(
    Math.ceil((Math.max(saldoMensal, 0) * 1.5) / 50) * 50,
    Math.ceil(((pr.aporteNecessario ?? 0) * 1.2) / 50) * 50,
    Math.ceil((form.aporte_mensal * 1.2) / 50) * 50,
    2000,
  )
  const moedaSimbolo = form.moeda === 'USD' ? 'US$' : 'R$'

  async function salvar() {
    if (!form.titulo.trim()) return setMsg({ tipo: 'erro', texto: 'O plano precisa de um nome.' })
    if (form.moeda === 'USD' && !parseBRL(form.cotacao)) {
      return setMsg({ tipo: 'erro', texto: 'Informe a cotação do dólar (R$ por US$).' })
    }
    setSaving(true)
    const { error } = await supabase
      .from('fin_planos')
      .update({
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        status: form.status,
        moeda: form.moeda,
        cotacao: form.moeda === 'USD' ? parseBRL(form.cotacao) : null,
        valor_guardado: parseBRL(form.valor_guardado) ?? 0,
        aporte_mensal: form.aporte_mensal,
        data_alvo: form.data_alvo || null,
        itens: atual.itens.filter(i => i.descricao.trim()),
        etapas,
        updated_at: new Date().toISOString(),
      })
      .eq('id', plano.id)
    setSaving(false)
    if (error) return setMsg({ tipo: 'erro', texto: 'Não foi possível salvar.' })
    setDirty(false)
    setMsg({ tipo: 'ok', texto: 'Plano salvo.' })
    router.refresh()
  }

  async function excluir() {
    if (!confirm(`Excluir o plano "${plano.titulo}"? Isso não pode ser desfeito.`)) return
    const { error } = await supabase.from('fin_planos').delete().eq('id', plano.id)
    if (!error) {
      router.push('/financas/planos')
      router.refresh()
    }
  }

  function alterarItem(i: number, campo: 'descricao' | 'valor', valor: string) {
    setItens(prev => prev.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it))
    setDirty(true)
  }

  function alterarEtapas(novas: EtapaPlano[]) {
    setEtapas(novas)
    setDirty(true)
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between gap-4">
        <Link href="/financas/planos" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Planos
        </Link>
        <button type="button" onClick={excluir} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-red-600">
          <Trash2 className="w-4 h-4" /> Excluir
        </button>
      </div>

      {/* Identidade */}
      <div className="space-y-3">
        <input
          value={form.titulo}
          onChange={e => alterar('titulo', e.target.value)}
          className="w-full bg-transparent text-xl font-semibold focus:outline-none border-b border-transparent focus:border-border"
        />
        <textarea
          rows={2}
          value={form.descricao}
          onChange={e => alterar('descricao', e.target.value)}
          placeholder="Por que este plano? O que muda na vida da família quando ele se realizar?"
          className={inputClass}
        />
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_PLANO) as StatusPlano[]).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => alterar('status', s)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                form.status === s ? `${STATUS_PLANO[s].className} border-transparent font-medium` : 'border-border text-muted-foreground hover:bg-secondary'
              }`}
            >
              {STATUS_PLANO[s].label}
            </button>
          ))}
        </div>
        {form.status === 'ativo' && (
          <p className="text-xs text-muted-foreground">Planos ativos entram na conta de quanto da sua sobra mensal já está comprometida.</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Custos */}
        <div className="lg:col-span-3 rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium">Quanto custa</h2>
              <p className="text-xs text-muted-foreground">A soma dos itens é a meta do plano</p>
            </div>
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              {(['BRL', 'USD'] as Moeda[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => alterar('moeda', m)}
                  className={`px-3 py-1.5 ${form.moeda === m ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
                >
                  {m === 'BRL' ? 'R$' : 'US$'}
                </button>
              ))}
            </div>
          </div>

          {form.moeda === 'USD' && (
            <div className="flex items-center gap-2 text-sm">
              <label className="text-muted-foreground whitespace-nowrap">Cotação: US$ 1 =</label>
              <input
                inputMode="decimal"
                value={form.cotacao}
                onChange={e => alterar('cotacao', e.target.value)}
                placeholder="5,50"
                className="w-24 px-2 py-1 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-muted-foreground">reais</span>
            </div>
          )}

          <ul className="space-y-2">
            {itens.map((it, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  value={it.descricao}
                  onChange={e => alterarItem(i, 'descricao', e.target.value)}
                  placeholder="Descrição do custo"
                  className={`${inputClass} flex-1`}
                />
                <div className="relative w-32 flex-shrink-0">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{moedaSimbolo}</span>
                  <input
                    inputMode="decimal"
                    value={it.valor}
                    onChange={e => alterarItem(i, 'valor', e.target.value)}
                    placeholder="0,00"
                    className={`${inputClass} pl-9 text-right ${!parseBRL(it.valor) ? 'border-amber-300' : ''}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setItens(prev => prev.filter((_, idx) => idx !== i)); setDirty(true) }}
                  className="p-1.5 text-muted-foreground hover:text-red-600"
                  title="Remover"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => { setItens(prev => [...prev, { descricao: '', valor: '' }]); setDirty(true) }}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Plus className="w-4 h-4" /> Adicionar custo
          </button>

          <div className="border-t border-border pt-3 flex items-center justify-between text-sm">
            <span className="font-medium">Meta total</span>
            <span className="text-right">
              <span className="font-semibold tabular-nums">{formatMoeda(pr.meta, form.moeda)}</span>
              {form.moeda === 'USD' && !pr.semCotacao && (
                <span className="block text-xs text-muted-foreground tabular-nums">{formatBRL(pr.metaBRL)}</span>
              )}
            </span>
          </div>
          {itens.some(i => !parseBRL(i.valor)) && (
            <p className="text-xs text-amber-700">Itens em amarelo ainda estão sem valor. Pesquise e preencha para a meta ficar real.</p>
          )}
        </div>

        {/* Simulador */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5 space-y-5">
          <h2 className="text-sm font-medium">Simulador</h2>

          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Já guardado para este plano ({moedaSimbolo})</label>
            <input
              inputMode="decimal"
              value={form.valor_guardado}
              onChange={e => alterar('valor_guardado', e.target.value)}
              placeholder="0,00"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <label className="text-sm text-muted-foreground">Aporte mensal</label>
              <span className="text-lg font-semibold tabular-nums">{formatBRL(form.aporte_mensal)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={maxSlider}
              step={50}
              value={form.aporte_mensal}
              onChange={e => alterar('aporte_mensal', Number(e.target.value))}
              className="w-full accent-[hsl(var(--primary))]"
            />
            <p className={`text-xs ${form.aporte_mensal > disponivel ? 'text-red-600' : 'text-muted-foreground'}`}>
              {form.aporte_mensal > disponivel
                ? `Acima do que sobra hoje (${formatBRL(disponivel)} livres${aportesOutros > 0 ? ' depois dos outros planos ativos' : ''}). Seria preciso cortar ${formatBRL(form.aporte_mensal - disponivel)}/mês em gastos.`
                : `Cabe na sua sobra: ${formatBRL(disponivel)} livres${aportesOutros > 0 ? ' depois dos outros planos ativos' : ''}.`}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Quando você quer realizar</label>
            <input
              type="month"
              value={form.data_alvo.slice(0, 7)}
              onChange={e => alterar('data_alvo', e.target.value ? `${e.target.value}-01` : '')}
              className={inputClass}
            />
          </div>

          <div className="rounded-md bg-secondary/60 p-4 space-y-2 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progresso</span>
                <span>{pr.progresso.toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-background overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pr.progresso}%` }} />
              </div>
            </div>
            {pr.semCotacao ? (
              <p className="text-muted-foreground">Informe a cotação do dólar para simular.</p>
            ) : pr.metaBRL === 0 ? (
              <p className="text-muted-foreground">Preencha os custos para ver a projeção.</p>
            ) : (
              <>
                <p>Falta: <strong className="tabular-nums">{formatBRL(pr.faltaBRL)}</strong></p>
                <p>
                  Nesse ritmo:{' '}
                  <strong>
                    {pr.mesesNoRitmo === 0
                      ? 'meta atingida'
                      : pr.dataPrevista
                        ? `${formatMesAno(pr.dataPrevista)} (${pr.mesesNoRitmo} meses)`
                        : 'nunca, sem aporte'}
                  </strong>
                </p>
                {pr.aporteNecessario !== null && pr.mesesAteAlvo !== null && (
                  <p>
                    Para chegar na data escolhida: <strong className="tabular-nums">{formatBRL(pr.aporteNecessario)}/mês</strong>
                    <span className="text-xs text-muted-foreground"> em {pr.mesesAteAlvo} meses</span>
                  </p>
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground pt-1">Sem considerar rendimentos nem variação do dólar.</p>
          </div>
        </div>
      </div>

      {/* Etapas */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-medium">Etapas</h2>
          <p className="text-xs text-muted-foreground">
            {etapas.length ? `${etapas.filter(e => e.feito).length} de ${etapas.length} concluídas` : 'O que precisa acontecer, além do dinheiro'}
          </p>
        </div>
        <ul className="space-y-1">
          {etapas.map((e, i) => (
            <li key={i} className="group flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-secondary/50">
              <button
                type="button"
                onClick={() => alterarEtapas(etapas.map((x, idx) => idx === i ? { ...x, feito: !x.feito } : x))}
                className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                  e.feito ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                }`}
              >
                {e.feito && <Check className="w-3 h-3" />}
              </button>
              <input
                value={e.texto}
                onChange={ev => alterarEtapas(etapas.map((x, idx) => idx === i ? { ...x, texto: ev.target.value } : x))}
                className={`flex-1 bg-transparent text-sm focus:outline-none ${e.feito ? 'line-through text-muted-foreground' : ''}`}
              />
              <button
                type="button"
                onClick={() => alterarEtapas(etapas.filter((_, idx) => idx !== i))}
                className="p-0.5 text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 hover:text-red-600"
                title="Remover"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={ev => {
            ev.preventDefault()
            if (!novaEtapa.trim()) return
            alterarEtapas([...etapas, { texto: novaEtapa.trim(), feito: false }])
            setNovaEtapa('')
          }}
          className="flex gap-2"
        >
          <input
            value={novaEtapa}
            onChange={e => setNovaEtapa(e.target.value)}
            placeholder="Nova etapa..."
            className={inputClass}
          />
          <button type="submit" className="px-3 rounded-md border border-border hover:bg-secondary">
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Barra de salvar */}
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-6 left-0 right-0 lg:left-64 z-40 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-background px-4 py-2 shadow-lg">
          <span className={`text-sm ${msg?.tipo === 'erro' ? 'text-red-600' : 'text-muted-foreground'}`}>
            {msg?.texto ?? (dirty ? 'Alterações não salvas' : 'Tudo salvo')}
          </span>
          <button
            type="button"
            onClick={salvar}
            disabled={saving || !dirty}
            className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
