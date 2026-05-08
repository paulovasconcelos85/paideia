'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Quote } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Citacao } from '@/lib/types'
import { formatDate } from '@/lib/utils'

interface Livro { id: string; titulo: string; autor: string | null }

interface Props {
  citacoes: Citacao[]
  livros: Livro[]
}

export default function CitacoesClient({ citacoes: initial, livros }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()

  const [citacoes, setCitacoes] = useState(initial)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ texto: '', livro_id: '', pagina: '' })

  async function salvar() {
    if (!form.texto.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('citacoes')
      .insert({
        texto: form.texto.trim(),
        livro_id: form.livro_id || null,
        pagina: form.pagina ? Number(form.pagina) : null,
      })
      .select('*, livros(id, titulo, autor)')
      .single()

    setSaving(false)
    if (!error && data) {
      setCitacoes(prev => [data as Citacao, ...prev])
      setModalOpen(false)
      setForm({ texto: '', livro_id: '', pagina: '' })
      startTransition(() => router.refresh())
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Citações</h1>
          <p className="text-sm text-muted-foreground mt-1">{citacoes.length} citações registradas</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova citação
        </button>
      </div>

      {citacoes.length === 0 ? (
        <div className="rounded-lg border border-border p-12 text-center space-y-3">
          <Quote className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Nenhuma citação ainda. Registre a primeira.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {citacoes.map(c => (
            <div key={c.id} className="rounded-lg border border-border bg-card p-5 space-y-3">
              <blockquote className="text-sm leading-relaxed border-l-2 border-primary/50 pl-4 italic text-foreground/90">
                "{c.texto}"
              </blockquote>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {c.livros?.titulo
                    ? `${c.livros.titulo}${c.livros.autor ? ` — ${c.livros.autor}` : ''}${c.pagina ? `, p. ${c.pagina}` : ''}`
                    : 'Sem livro vinculado'
                  }
                </span>
                <span>{formatDate(c.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="bg-background rounded-xl border border-border w-full max-w-lg shadow-xl p-6 space-y-5">
            <h2 className="text-lg font-semibold">Nova citação</h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Citação *</label>
                <textarea
                  rows={4}
                  value={form.texto}
                  onChange={e => setForm(p => ({ ...p, texto: e.target.value }))}
                  placeholder="Digite a citação..."
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Livro</label>
                  <select
                    value={form.livro_id}
                    onChange={e => setForm(p => ({ ...p, livro_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Sem livro</option>
                    {livros.map(l => <option key={l.id} value={l.id}>{l.titulo}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Página</label>
                  <input
                    type="number"
                    value={form.pagina}
                    onChange={e => setForm(p => ({ ...p, pagina: e.target.value }))}
                    placeholder="Ex: 142"
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={saving || !form.texto.trim()}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
