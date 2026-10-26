'use client'

import { useState } from 'react'
import { CreditCard, FileUp, Hourglass, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  CATEGORIAS_DESPESA, CATEGORIAS_SUPERFLUAS, formatBRL, fraseCustoEmTempo, nomeMes,
  type Cartao, type Lancamento, type Plano,
} from '@/lib/financas'
import Sheet from '../_components/sheet'

interface Props {
  familiaId: string
  userId: string
  cartoes: Cartao[]
  competencia: string
  plano: Plano | null
  renda: number
  onImported: (novos: Lancamento[]) => void
  onClose: () => void
}

interface ItemFatura {
  data: string | null
  descricao: string
  valor: number
  categoria: string
  parcela_atual: number | null
  parcelas_total: number | null
  duplicado: boolean
  despesa_id: string | null
  // estado da revisão
  incluir: boolean
  acompanhar: boolean
}

function competenciaVizinha(competencia: string, delta: number) {
  const d = new Date(`${competencia}T12:00:00`)
  const v = new Date(d.getFullYear(), d.getMonth() + delta, 1)
  return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-01`
}

/** Fotos de celular passam fácil de 4 MB: reduz para no máximo 2200 px em JPEG. */
async function comprimirImagem(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith('image/') || arquivo.size < 1.5 * 1024 * 1024) return arquivo
  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.85))
    return blob ? new File([blob], 'fatura.jpg', { type: 'image/jpeg' }) : arquivo
  } catch {
    return arquivo
  }
}

export default function ImportarFatura({ familiaId, userId, cartoes, competencia: compInicial, plano, renda, onImported, onClose }: Props) {
  const supabase = createClient()
  const [cartaoId, setCartaoId] = useState(cartoes[0]?.id ?? '')
  const [competencia, setCompetencia] = useState(compInicial)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [itens, setItens] = useState<ItemFatura[] | null>(null)
  const [observacao, setObservacao] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function ler() {
    if (!arquivo) return setErro('Escolha a foto, o PDF ou o CSV da fatura.')
    setCarregando(true)
    setErro(null)
    try {
      const form = new FormData()
      form.append('arquivo', await comprimirImagem(arquivo))
      form.append('cartao_id', cartaoId)
      form.append('competencia', competencia)
      const res = await fetch('/api/financas/fatura', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Não foi possível ler a fatura.')
      setItens((data.itens as Omit<ItemFatura, 'incluir' | 'acompanhar'>[]).map(i => ({
        ...i,
        incluir: !i.duplicado,
        acompanhar: !!i.parcelas_total && !i.despesa_id && (i.parcelas_total - (i.parcela_atual ?? 1)) > 0,
      })))
      setObservacao(data.observacao ?? '')
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }

  function alterar(i: number, mudanca: Partial<ItemFatura>) {
    setItens(prev => prev!.map((it, idx) => idx === i ? { ...it, ...mudanca } : it))
  }

  async function salvar() {
    const escolhidos = (itens ?? []).filter(i => i.incluir)
    if (escolhidos.length === 0) return setErro('Nenhum item selecionado.')
    setSalvando(true)
    setErro(null)

    // Parcelas novas entram no orçamento para o "quanto falta" e a projeção ficarem certos
    const novasParcelas = escolhidos.filter(i => i.acompanhar && i.parcelas_total && !i.despesa_id)
    const idsCriados = new Map<ItemFatura, string>()
    if (novasParcelas.length > 0) {
      const { data, error } = await supabase
        .from('fin_despesas')
        .insert(novasParcelas.map(i => ({
          familia_id: familiaId,
          user_id: userId,
          descricao: i.descricao,
          categoria: i.categoria,
          valor: i.valor,
          frequencia: 'parcelada',
          parcelas_total: i.parcelas_total,
          parcelas_restantes: i.parcelas_total! - (i.parcela_atual ?? 1) + 1,
          parcelas_ref: competencia,
          cartao_id: cartaoId || null,
          essencial: !CATEGORIAS_SUPERFLUAS.has(i.categoria),
        })))
        .select('id')
      if (error || !data) {
        setSalvando(false)
        return setErro('Não foi possível registrar as parcelas.')
      }
      novasParcelas.forEach((i, idx) => idsCriados.set(i, data[idx].id))
    }

    const { data, error } = await supabase
      .from('fin_lancamentos')
      .insert(escolhidos.map(i => ({
        familia_id: familiaId,
        user_id: userId,
        data: i.data ?? competencia,
        competencia,
        descricao: i.descricao,
        valor: i.valor,
        categoria: i.categoria,
        cartao_id: cartaoId || null,
        parcela_atual: i.parcela_atual,
        parcelas_total: i.parcelas_total,
        origem: 'fatura',
        despesa_id: i.despesa_id ?? idsCriados.get(i) ?? null,
      })))
      .select()
    setSalvando(false)
    if (error || !data) return setErro('Não foi possível salvar os lançamentos.')
    onImported(data as Lancamento[])
  }

  const chip = (ativo: boolean) =>
    `flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
      ativo ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border hover:bg-secondary'
    }`

  // ── Revisão
  if (itens) {
    const escolhidos = itens.filter(i => i.incluir)
    const total = escolhidos.reduce((a, i) => a + i.valor, 0)
    const superfluo = escolhidos.filter(i => CATEGORIAS_SUPERFLUAS.has(i.categoria)).reduce((a, i) => a + i.valor, 0)
    const custo = fraseCustoEmTempo(superfluo, plano, renda)

    return (
      <Sheet titulo="Confira a fatura" onClose={onClose}>
        <div className="space-y-4">
          <div className="rounded-lg bg-secondary/60 p-3 text-sm space-y-1">
            <p><strong className="tabular-nums">{formatBRL(total)}</strong> em {escolhidos.length} itens · fatura de {nomeMes(competencia).toLowerCase()}</p>
            {superfluo > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700">
                <Hourglass className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{formatBRL(superfluo)} em lazer, assinaturas e pessoais{custo ? `: ${custo}` : ''}</span>
              </p>
            )}
            {observacao && <p className="text-xs text-muted-foreground">{observacao}</p>}
          </div>

          <ul className="divide-y divide-border rounded-lg border border-border">
            {itens.map((it, i) => (
              <li key={i} className={`space-y-2 px-3 py-2.5 ${it.incluir ? '' : 'opacity-50'}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={it.incluir}
                    onChange={e => alterar(i, { incluir: e.target.checked })}
                    className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{it.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {it.data && new Date(`${it.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      {it.parcelas_total && ` · parcela ${it.parcela_atual}/${it.parcelas_total}`}
                      {it.duplicado && <span className="text-amber-700"> · já lançado</span>}
                    </p>
                  </div>
                  <span className={`text-sm font-medium tabular-nums ${it.valor < 0 ? 'text-green-700' : ''}`}>{formatBRL(it.valor)}</span>
                </div>
                {it.incluir && (
                  <div className="flex flex-wrap items-center gap-2 pl-7">
                    <select
                      value={it.categoria}
                      onChange={e => alterar(i, { categoria: e.target.value })}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                    >
                      {Object.entries(CATEGORIAS_DESPESA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    {it.parcelas_total && !it.despesa_id && (it.parcelas_total - (it.parcela_atual ?? 1)) > 0 && (
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={it.acompanhar}
                          onChange={e => alterar(i, { acompanhar: e.target.checked })}
                          className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                        />
                        acompanhar as parcelas que faltam
                      </label>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={() => setItens(null)} className="flex-1 rounded-lg border border-border py-3 text-sm">
              Voltar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="flex-[2] rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : `Salvar ${escolhidos.length} lançamentos`}
            </button>
          </div>
        </div>
      </Sheet>
    )
  }

  // ── Envio
  return (
    <Sheet titulo="Importar fatura" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Mande a foto, o print, o PDF ou o CSV da fatura. A IA separa cada compra e você só confere.
        </p>

        {cartoes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Cartão</p>
            <div className="flex flex-wrap gap-2">
              {cartoes.map(c => (
                <button key={c.id} type="button" onClick={() => setCartaoId(c.id)} className={chip(cartaoId === c.id)}>
                  <CreditCard className="h-3.5 w-3.5" /> {c.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Fatura de</p>
          <div className="flex flex-wrap gap-2">
            {[-1, 0, 1].map(d => {
              const c = competenciaVizinha(compInicial, d)
              return (
                <button key={c} type="button" onClick={() => setCompetencia(c)} className={chip(competencia === c)}>
                  {nomeMes(c)}
                </button>
              )
            })}
          </div>
        </div>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-center hover:bg-secondary/50">
          <FileUp className="h-8 w-8 text-primary" />
          <span className="text-sm font-medium">{arquivo ? arquivo.name : 'Tirar foto ou escolher arquivo'}</span>
          <span className="text-xs text-muted-foreground">Foto, PDF, CSV ou OFX</span>
          <input
            type="file"
            accept="image/*,application/pdf,.csv,.ofx,.txt"
            onChange={e => { setArquivo(e.target.files?.[0] ?? null); setErro(null) }}
            className="hidden"
          />
        </label>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="button"
          onClick={ler}
          disabled={carregando || !arquivo}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-base font-medium text-primary-foreground disabled:opacity-50"
        >
          {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
          {carregando ? 'Lendo a fatura...' : 'Ler fatura'}
        </button>
        <p className="text-center text-[11px] text-muted-foreground">
          O arquivo vai para a IA configurada em Configurações só para a leitura e não fica guardado.
        </p>
      </div>
    </Sheet>
  )
}
