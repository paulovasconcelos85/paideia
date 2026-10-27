'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, ChevronDown, Loader2, Plus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  formatBRL, formatMesAno, formatMoeda, parseBRL, projetarPlano,
  type EtapaPlano, type Moeda, type Plano,
} from '@/lib/financas'
import { BRASAO_HARVARD, fotoDoPlano } from '@/lib/imagens'

interface Props {
  plano: Plano
  sobra: number          // renda do mês menos as contas, antes dos aportes
  aportesOutros: number  // aportes dos outros planos ativos, que disputam a mesma sobra
  ptax: number | null
  dolarGuardado: number  // US$ guardados em Patrimônio
  aportesPagos: number   // R$ já aportados (marcados como pagos nas contas)
  mesesComAporte: number
}

const texto = (v: number | null | undefined) =>
  v ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
const campo = 'rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const inputClass = `w-full ${campo}`

/** Um plano em três perguntas: quanto custa, quanto já tenho, quanto guardo por mês. Salva sozinho. */
export default function PlanoDetalhe({ plano, sobra, aportesOutros, ptax, dolarGuardado, aportesPagos, mesesComAporte }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [titulo, setTitulo] = useState(plano.titulo)
  const [descricao, setDescricao] = useState(plano.descricao ?? '')
  const [ativo, setAtivo] = useState(plano.status === 'ativo')
  const [moeda, setMoeda] = useState<Moeda>(plano.moeda)
  const [cotacao, setCotacao] = useState(texto(plano.cotacao ?? ptax))
  const [guardadoBase, setGuardadoBase] = useState(texto(plano.valor_guardado))
  const [guardadoPor, setGuardadoPor] = useState(plano.guardado_por ?? 'aportes')
  const [aporte, setAporte] = useState(Number(plano.aporte_mensal))
  const [diaAporte, setDiaAporte] = useState(String(plano.dia_aporte ?? 27))
  const [dataAlvo, setDataAlvo] = useState(plano.data_alvo ?? '')
  const [itens, setItens] = useState(plano.itens.map(i => ({ descricao: i.descricao, valor: texto(i.valor) })))
  const [etapas, setEtapas] = useState<EtapaPlano[]>(plano.etapas)
  const [novaEtapa, setNovaEtapa] = useState('')
  const [aberto, setAberto] = useState<{ custos: boolean; data: boolean; etapas: boolean; sobre: boolean }>({
    custos: plano.itens.length > 1, data: !!plano.data_alvo, etapas: false, sobre: false,
  })
  const [estado, setEstado] = useState<'salvo' | 'pendente' | 'salvando' | 'erro'>('salvo')

  const cot = parseBRL(cotacao)
  const simbolo = moeda === 'USD' ? 'US$' : 'R$'
  const pelosDolares = moeda === 'USD' && guardadoPor === 'dolar'

  // O plano como está na tela, para a projeção ao vivo
  const atual: Plano = useMemo(() => ({
    ...plano,
    moeda,
    cotacao: cot,
    valor_guardado: parseBRL(guardadoBase) ?? 0,
    aporte_mensal: aporte,
    data_alvo: dataAlvo || null,
    guardado_por: guardadoPor,
    aportado: pelosDolares ? dolarGuardado * (cot ?? 0) : aportesPagos,
    itens: itens.map(i => ({ descricao: i.descricao, valor: parseBRL(i.valor) ?? 0 })),
  }), [plano, moeda, cot, guardadoBase, aporte, dataAlvo, guardadoPor, pelosDolares, dolarGuardado, aportesPagos, itens])
  const pr = projetarPlano(atual)

  // ── Salva sozinho, um instante depois da última mudança
  const primeira = useRef(true)
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return }
    setEstado('pendente')
    const t = setTimeout(async () => {
      if (!titulo.trim() || (moeda === 'USD' && !cot)) return setEstado('erro')
      setEstado('salvando')
      const dia = Number(diaAporte)
      const { error } = await supabase.from('fin_planos').update({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        status: ativo ? 'ativo' : plano.status === 'concluido' ? 'concluido' : 'pausado',
        moeda,
        cotacao: moeda === 'USD' ? cot : null,
        valor_guardado: parseBRL(guardadoBase) ?? 0,
        aporte_mensal: aporte,
        dia_aporte: dia >= 1 && dia <= 31 ? dia : 27,
        guardado_por: guardadoPor,
        data_alvo: dataAlvo || null,
        itens: atual.itens.filter(i => i.descricao.trim() || i.valor),
        etapas,
        updated_at: new Date().toISOString(),
      }).eq('id', plano.id)
      setEstado(error ? 'erro' : 'salvo')
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo, descricao, ativo, moeda, cotacao, guardadoBase, guardadoPor, aporte, diaAporte, dataAlvo, itens, etapas])

  // Quanto custa: com um item só (ou nenhum), um único campo; com vários, a soma
  const umItem = itens.length <= 1
  function mudarCusto(v: string) {
    setItens(prev => (prev.length === 0 ? [{ descricao: 'Custo total', valor: v }] : [{ ...prev[0], valor: v }]))
  }

  async function excluir() {
    if (!confirm(`Excluir o plano "${plano.titulo}"? Os aportes registrados também saem.`)) return
    const { error } = await supabase.from('fin_planos').delete().eq('id', plano.id)
    if (!error) { router.push('/financas/planos'); router.refresh() }
  }

  const imagem = fotoDoPlano({ titulo, descricao, moeda })
  const disponivel = Math.max(sobra - aportesOutros, 0)
  const maxSlider = Math.max(Math.ceil((Math.max(sobra, 0) * 1.2) / 100) * 100, Math.ceil((aporte * 1.5) / 100) * 100, 3000)
  const alternar = (k: keyof typeof aberto) => setAberto(p => ({ ...p, [k]: !p[k] }))

  const resposta = pr.semCotacao ? 'Informe a cotação do dólar'
    : pr.metaBRL === 0 ? 'Diga quanto custa para ver quando você chega lá'
    : pr.mesesNoRitmo === 0 ? 'Meta atingida! 🎉'
    : pr.dataPrevista ? `Você chega lá em ${formatMesAno(pr.dataPrevista)}`
    : 'Defina quanto guardar por mês'

  const secao = (k: keyof typeof aberto, rotulo: string, conteudo: React.ReactNode) => (
    <div className="rounded-xl border border-border bg-card">
      <button type="button" onClick={() => alternar(k)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium">
        {rotulo}
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${aberto[k] ? 'rotate-180' : ''}`} />
      </button>
      {aberto[k] && <div className="space-y-3 border-t border-border px-4 py-3">{conteudo}</div>}
    </div>
  )

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/financas/planos" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Planos
        </Link>
        <span className={`flex items-center gap-1 text-xs ${estado === 'erro' ? 'text-red-600' : 'text-muted-foreground'}`}>
          {estado === 'salvando' && <Loader2 className="h-3 w-3 animate-spin" />}
          {estado === 'salvo' && <Check className="h-3 w-3" />}
          {estado === 'salvo' ? 'Salvo' : estado === 'salvando' ? 'Salvando' : estado === 'pendente' ? 'Editando…'
            : !titulo.trim() ? 'Dê um nome ao plano' : moeda === 'USD' && !cot ? 'Informe a cotação' : 'Não foi possível salvar'}
        </span>
      </div>

      {/* A resposta: quando chego lá */}
      <div className="relative overflow-hidden rounded-2xl bg-[#2a2185] text-white">
        {imagem && <Image src={imagem.foto.src} alt="" fill priority placeholder="blur" sizes="(min-width: 1024px) 1100px, 100vw" className="object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1e1760]/95 via-[#1e1760]/60 to-[#1e1760]/20" />
        {imagem?.harvard && <Image src={BRASAO_HARVARD} alt="Harvard" width={56} height={54} className="absolute right-4 top-4 drop-shadow-lg" />}
        <div className="relative space-y-3 p-5 pt-16">
          <input
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            className="w-full bg-transparent text-lg font-semibold text-white placeholder:text-white/60 focus:outline-none"
            placeholder="Nome do plano"
          />
          <p className="text-2xl font-semibold leading-tight sm:text-3xl">{resposta}</p>
          {pr.dataPrevista && pr.mesesNoRitmo ? (
            <p className="text-sm text-white/80">em {pr.mesesNoRitmo} {pr.mesesNoRitmo === 1 ? 'mês' : 'meses'}, guardando {formatBRL(aporte)} por mês</p>
          ) : null}
          {pr.metaBRL > 0 && (
            <div className="space-y-1">
              <div className="h-2.5 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white" style={{ width: `${pr.progresso}%` }} />
              </div>
              <p className="text-xs text-white/80">
                {formatBRL(pr.guardadoBRL)} de {formatBRL(pr.metaBRL)} · {pr.progresso.toFixed(0)}% · faltam {formatBRL(pr.faltaBRL)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 1. Quanto custa */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">1. Quanto custa?</p>
          <div className="flex overflow-hidden rounded-md border border-border text-xs">
            {(['BRL', 'USD'] as Moeda[]).map(m => (
              <button key={m} type="button" onClick={() => setMoeda(m)} className={`px-3 py-1 ${moeda === m ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}>
                {m === 'BRL' ? 'R$' : 'US$'}
              </button>
            ))}
          </div>
        </div>
        {umItem ? (
          <div className="flex items-baseline gap-2 border-b-2 border-primary/40 pb-1 focus-within:border-primary">
            <span className="text-xl text-muted-foreground">{simbolo}</span>
            <input
              inputMode="decimal"
              value={itens[0]?.valor ?? ''}
              onChange={e => mudarCusto(e.target.value)}
              placeholder="0,00"
              data-grande
              className="w-full bg-transparent text-3xl font-semibold tabular-nums focus:outline-none"
            />
          </div>
        ) : (
          <p className="text-3xl font-semibold tabular-nums">{formatMoeda(pr.meta, moeda)}</p>
        )}
        {moeda === 'USD' && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            US$ 1 = R$
            <input inputMode="decimal" value={cotacao} onChange={e => setCotacao(e.target.value)} placeholder="5,50" className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm" />
            {ptax && cot !== Math.round(ptax * 100) / 100 && (
              <button type="button" onClick={() => setCotacao(texto(ptax))} className="text-xs text-primary hover:underline">usar o de hoje</button>
            )}
            {!pr.semCotacao && pr.meta > 0 && <span className="ml-auto">≈ {formatBRL(pr.metaBRL)}</span>}
          </div>
        )}
        <button type="button" onClick={() => alternar('custos')} className="flex items-center gap-1 text-xs text-primary">
          {umItem ? 'Detalhar os custos' : `Ver os ${itens.length} custos`}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto.custos ? 'rotate-180' : ''}`} />
        </button>
        {aberto.custos && (
          <div className="space-y-2">
            {itens.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={it.descricao} onChange={e => setItens(p => p.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)))} placeholder="Ex.: anuidade" className={`${campo} min-w-0 flex-1`} />
                <input inputMode="decimal" value={it.valor} onChange={e => setItens(p => p.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))} placeholder="0,00" className={`${campo} w-32 flex-shrink-0 text-right tabular-nums`} />
                <button type="button" onClick={() => setItens(p => p.filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-red-600" aria-label="Remover">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setItens(p => [...p, { descricao: '', valor: '' }])} className="flex items-center gap-1 text-sm text-primary">
              <Plus className="h-4 w-4" /> Adicionar custo
            </button>
          </div>
        )}
      </div>

      {/* 2. Quanto já tenho */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">2. Quanto você já tem?</p>
          <p className="text-lg font-semibold tabular-nums">{formatBRL(pr.guardadoBRL)}</p>
        </div>
        {moeda === 'USD' && (
          <div className="flex gap-2">
            {([['aportes', 'Pelos aportes'], ['dolar', 'Pelo dólar guardado']] as const).map(([k, rotulo]) => (
              <button
                key={k}
                type="button"
                onClick={() => setGuardadoPor(k)}
                className={`flex-1 rounded-full border px-3 py-1.5 text-xs ${guardadoPor === k ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border'}`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        )}
        {pelosDolares ? (
          <p className="text-xs text-muted-foreground">
            Conta os {formatMoeda(dolarGuardado, 'USD')} guardados em <Link href="/financas/patrimonio" className="text-primary underline">Patrimônio</Link>.
            Ao comprar dólar com o aporte, registre a compra lá.
          </p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Guardado antes de começar ({simbolo})
              <input inputMode="decimal" value={guardadoBase} onChange={e => setGuardadoBase(e.target.value)} placeholder="0,00" className="ml-auto w-32 rounded-md border border-border bg-background px-2 py-1 text-right text-sm" />
            </label>
            <p className="text-xs text-muted-foreground">
              {mesesComAporte > 0
                ? `+ ${formatBRL(aportesPagos)} em ${mesesComAporte} ${mesesComAporte === 1 ? 'aporte marcado' : 'aportes marcados'} como pagos nas Contas do mês.`
                : 'Cada aporte que você marcar como pago nas Contas do mês soma aqui sozinho.'}
            </p>
          </>
        )}
      </div>

      {/* 3. Quanto guardo por mês */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">3. Quanto você guarda por mês?</p>
          <div className="flex items-baseline gap-1">
            <span className="text-sm text-muted-foreground">R$</span>
            <input
              inputMode="decimal"
              value={aporte ? String(aporte).replace('.', ',') : ''}
              onChange={e => setAporte(parseBRL(e.target.value) ?? 0)}
              placeholder="0"
              className="w-28 bg-transparent text-right text-lg font-semibold tabular-nums focus:outline-none"
            />
          </div>
        </div>
        <input type="range" min={0} max={maxSlider} step={50} value={aporte} onChange={e => setAporte(Number(e.target.value))} className="w-full accent-[hsl(var(--primary))]" />
        <p className={`text-xs ${aporte > disponivel ? 'text-red-600' : 'text-muted-foreground'}`}>
          {aporte > disponivel
            ? `Acima do que sobra este mês: ${formatBRL(disponivel)} livres${aportesOutros > 0 ? ' depois dos outros planos' : ''}. Faltariam ${formatBRL(aporte - disponivel)}.`
            : `Cabe: sobram ${formatBRL(disponivel)} este mês${aportesOutros > 0 ? ' depois dos outros planos' : ''} (renda menos contas).`}
        </p>
        {ativo && aporte > 0 && (
          <p className="flex flex-wrap items-center gap-1 rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            Aparece nas Contas do mês como “Guardar: {titulo || 'plano'}”, todo dia
            <input inputMode="numeric" value={diaAporte} onChange={e => setDiaAporte(e.target.value.replace(/\D/g, '').slice(0, 2))} className="w-10 rounded border border-border bg-background px-1 text-center" />
            {Number(diaAporte) >= 15 ? '(no mês anterior, logo depois do salário).' : '.'}
          </p>
        )}
      </div>

      {secao('data', 'Tenho uma data em mente', (
        <>
          <input type="month" value={dataAlvo.slice(0, 7)} onChange={e => setDataAlvo(e.target.value ? `${e.target.value}-01` : '')} className={inputClass} />
          {pr.aporteNecessario !== null && pr.mesesAteAlvo !== null && pr.metaBRL > 0 && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span>Precisa guardar <strong className="tabular-nums">{formatBRL(pr.aporteNecessario)}/mês</strong> por {pr.mesesAteAlvo} meses</span>
              {Math.ceil(pr.aporteNecessario) !== aporte && (
                <button type="button" onClick={() => setAporte(Math.ceil(pr.aporteNecessario!))} className="whitespace-nowrap text-xs text-primary">usar este valor</button>
              )}
            </div>
          )}
        </>
      ))}

      {secao('etapas', `Etapas${etapas.length ? ` · ${etapas.filter(e => e.feito).length} de ${etapas.length}` : ''}`, (
        <>
          <ul className="space-y-1">
            {etapas.map((e, i) => (
              <li key={i} className="flex items-start gap-3 py-1">
                <button
                  type="button"
                  onClick={() => setEtapas(p => p.map((x, j) => (j === i ? { ...x, feito: !x.feito } : x)))}
                  className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${e.feito ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}
                >
                  {e.feito && <Check className="h-3 w-3" />}
                </button>
                <input
                  value={e.texto}
                  onChange={ev => setEtapas(p => p.map((x, j) => (j === i ? { ...x, texto: ev.target.value } : x)))}
                  className={`flex-1 bg-transparent text-sm focus:outline-none ${e.feito ? 'text-muted-foreground line-through' : ''}`}
                />
                <button type="button" onClick={() => setEtapas(p => p.filter((_, j) => j !== i))} className="p-0.5 text-muted-foreground hover:text-red-600" aria-label="Remover">
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={ev => { ev.preventDefault(); if (!novaEtapa.trim()) return; setEtapas(p => [...p, { texto: novaEtapa.trim(), feito: false }]); setNovaEtapa('') }}
            className="flex gap-2"
          >
            <input value={novaEtapa} onChange={e => setNovaEtapa(e.target.value)} placeholder="Nova etapa…" className={inputClass} />
            <button type="submit" className="rounded-md border border-border px-3 hover:bg-secondary" aria-label="Adicionar etapa"><Plus className="h-4 w-4" /></button>
          </form>
        </>
      ))}

      {secao('sobre', 'Por que este plano', (
        <textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="O que muda na sua vida quando ele se realizar?" className={inputClass} />
      ))}

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <label className="flex items-center gap-3 text-sm">
          <button
            type="button"
            role="switch"
            aria-checked={ativo}
            onClick={() => setAtivo(v => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${ativo ? 'bg-primary' : 'bg-input'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${ativo ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          {ativo ? 'Ativo: o aporte entra nas contas' : plano.status === 'concluido' ? 'Concluído' : 'Pausado: sem aporte nas contas'}
        </label>
        <button type="button" onClick={excluir} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-red-600">
          <Trash2 className="h-4 w-4" /> Excluir
        </button>
      </div>
    </div>
  )
}
