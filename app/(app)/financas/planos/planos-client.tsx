'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ChevronRight, Map, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  STATUS_PLANO, formatBRL, formatMesAno, formatMoeda, projetarPlano, type Plano,
} from '@/lib/financas'
import { MODELOS_PLANO } from '@/lib/planos-modelos'
import { BRASAO_HARVARD, fotoDoPlano } from '@/lib/imagens'

interface Props {
  userId: string
  familiaId: string
  planos: Plano[]
  saldoMensal: number
}

export default function PlanosClient({ userId, familiaId, planos, saldoMensal }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [modeloId, setModeloId] = useState('em-branco')
  const [titulo, setTitulo] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const ativos = planos.filter(p => p.status === 'ativo')
  const aportesAtivos = ativos.reduce((a, p) => a + Number(p.aporte_mensal), 0)
  const excedente = aportesAtivos - Math.max(saldoMensal, 0)

  function escolherModelo(id: string) {
    setModeloId(id)
    const modelo = MODELOS_PLANO.find(m => m.id === id)!
    setTitulo(id === 'em-branco' ? '' : modelo.titulo)
  }

  async function criar() {
    if (!titulo.trim()) return setErro('Dê um nome ao plano.')
    const modelo = MODELOS_PLANO.find(m => m.id === modeloId)!
    setSaving(true)
    const { data, error } = await supabase
      .from('fin_planos')
      .insert({
        user_id: userId,
        familia_id: familiaId,
        titulo: titulo.trim(),
        descricao: modelo.descricao || null,
        moeda: modelo.moeda,
        itens: modelo.itens,
        etapas: modelo.etapas,
      })
      .select('id')
      .single()
    setSaving(false)
    if (error || !data) return setErro('Não foi possível criar o plano.')
    router.push(`/financas/planos/${data.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Sobra mensal disponível para planos</p>
          <p className={`text-2xl font-semibold tabular-nums ${saldoMensal >= 0 ? '' : 'text-red-600'}`}>
            {formatBRL(saldoMensal)}
          </p>
        </div>
        <button
          onClick={() => { setModalOpen(true); setErro(null); escolherModelo('em-branco') }}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo plano
        </button>
      </div>

      {excedente > 0 && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-gray-900">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
          <p>
            Os planos ativos somam <strong>{formatBRL(aportesAtivos)}</strong> de aporte mensal, mas sobram só{' '}
            <strong>{formatBRL(Math.max(saldoMensal, 0))}</strong>. Faltam {formatBRL(excedente)}: corte gastos,
            reduza aportes ou pause algum plano.
          </p>
        </div>
      )}

      {planos.length === 0 ? (
        <div className="rounded-lg border border-border p-12 text-center space-y-3">
          <Map className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Nenhum plano ainda. Crie cenários para comparar caminhos: reserva, quitar dívidas, pós nos EUA, carreira jurídica lá fora...
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {planos.map(p => {
              const pr = projetarPlano(p)
              const imagem = fotoDoPlano(p)
              return (
                <Link
                  key={p.id}
                  href={`/financas/planos/${p.id}`}
                  className="group overflow-hidden rounded-lg border border-border bg-card p-5 space-y-3 hover:border-primary/50 transition-colors"
                >
                  {imagem && (
                    <div className="relative -mx-5 -mt-5 mb-4 h-32 overflow-hidden">
                      <Image
                        src={imagem.foto.src}
                        alt={imagem.foto.lugar}
                        fill
                        placeholder="blur"
                        sizes="(min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      {imagem.harvard && (
                        <Image src={BRASAO_HARVARD} alt="Harvard" width={44} height={43} className="absolute right-3 top-3 drop-shadow-lg" />
                      )}
                      <p className="absolute bottom-2 left-3 text-[11px] text-white/90">{imagem.foto.lugar}</p>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.titulo}</p>
                      {p.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{p.descricao}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${STATUS_PLANO[p.status].className}`}>
                      {STATUS_PLANO[p.status].label}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatMoeda(Number(p.valor_guardado), p.moeda)} de {pr.meta > 0 ? formatMoeda(pr.meta, p.moeda) : 'meta a definir'}</span>
                      <span>{pr.progresso.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pr.progresso}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {pr.semCotacao
                        ? 'Informe a cotação do dólar'
                        : pr.metaBRL === 0
                          ? 'Preencha os custos'
                          : pr.dataPrevista
                            ? `Previsão: ${formatMesAno(pr.dataPrevista)}`
                            : 'Sem aporte mensal definido'}
                    </span>
                    <ChevronRight className="w-4 h-4 group-hover:text-primary" />
                  </div>
                </Link>
              )
            })}
          </div>

          {planos.length > 1 && (
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">Comparar cenários</th>
                    <th className="text-right font-medium px-4 py-2.5">Meta (R$)</th>
                    <th className="text-right font-medium px-4 py-2.5">Falta</th>
                    <th className="text-right font-medium px-4 py-2.5">Aporte/mês</th>
                    <th className="text-right font-medium px-4 py-2.5">Previsão</th>
                    <th className="text-right font-medium px-4 py-2.5">Etapas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {planos.map(p => {
                    const pr = projetarPlano(p)
                    const feitas = p.etapas.filter(e => e.feito).length
                    return (
                      <tr key={p.id}>
                        <td className="px-4 py-2.5">
                          <Link href={`/financas/planos/${p.id}`} className="hover:text-primary">{p.titulo}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{pr.semCotacao ? '—' : formatBRL(pr.metaBRL)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{pr.semCotacao ? '—' : formatBRL(pr.faltaBRL)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatBRL(Number(p.aporte_mensal))}</td>
                        <td className="px-4 py-2.5 text-right">{pr.dataPrevista && pr.metaBRL > 0 ? formatMesAno(pr.dataPrevista) : '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{p.etapas.length ? `${feitas}/${p.etapas.length}` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="bg-background rounded-t-2xl sm:rounded-xl border border-border w-full sm:max-w-lg shadow-xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 space-y-5 max-h-[92vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">Novo plano</h2>

            <div className="space-y-2">
              <p className="text-sm font-medium">Começar a partir de</p>
              <div className="grid gap-2">
                {MODELOS_PLANO.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => escolherModelo(m.id)}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      modeloId === m.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary'
                    }`}
                  >
                    <p className="text-sm font-medium">{m.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.id === 'em-branco'
                        ? 'Monte do zero: custos, etapas e prazo do seu jeito'
                        : `${m.itens.length} custos e ${m.etapas.length} etapas sugeridos para você preencher e ajustar`}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome do plano *</label>
              <input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ex: Mudança para a Flórida em 2029"
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <div className="flex gap-3 justify-end pt-2 [&>button]:flex-1 sm:[&>button]:flex-none">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={criar}
                disabled={saving}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Criando...' : 'Criar e editar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
