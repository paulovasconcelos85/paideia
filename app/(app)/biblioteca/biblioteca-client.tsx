'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Livro, Eixo, Status } from '@/lib/types'
import { STATUS_CONFIG, formatDate, starArray } from '@/lib/utils'

const ALL_STATUS: { value: Status | 'todos'; label: string }[] = [
  { value: 'todos',   label: 'Todos' },
  { value: 'lido',    label: 'Lidos' },
  { value: 'lendo',   label: 'Lendo' },
  { value: 'comprar', label: 'Comprar' },
  { value: 'quero',   label: 'Na fila' },
  { value: 'reler',   label: 'Reler' },
]

interface Props {
  livros: Livro[]
  eixos: Eixo[]
}

export default function BibliotecaClient({ livros: initial, eixos }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()

  const [livros, setLivros] = useState(initial)
  const [filtroStatus, setFiltroStatus] = useState<Status | 'todos'>('todos')
  const [filtroEixo, setFiltroEixo] = useState<number | 'todos'>('todos')
  const [busca, setBusca] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [form, setForm] = useState({
    titulo: '', autor: '', eixo_id: '', status: 'quero' as Status, nota: 0,
  })

  const filtered = useMemo(() => livros.filter(l => {
    if (filtroStatus !== 'todos' && l.status !== filtroStatus) return false
    if (filtroEixo !== 'todos' && l.eixo_id !== filtroEixo) return false
    if (busca && !l.titulo.toLowerCase().includes(busca.toLowerCase()) &&
        !(l.autor ?? '').toLowerCase().includes(busca.toLowerCase())) return false
    return true
  }), [livros, filtroStatus, filtroEixo, busca])

  async function salvarLivro() {
    if (!form.titulo.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('livros')
      .insert({
        titulo: form.titulo.trim(),
        autor: form.autor.trim() || null,
        eixo_id: form.eixo_id ? Number(form.eixo_id) : null,
        status: form.status,
        nota: form.status === 'lido' && form.nota > 0 ? form.nota : null,
      })
      .select('*, eixos(*)')
      .single()

    setSaving(false)
    if (!error && data) {
      setLivros(prev => [data as Livro, ...prev])
      setModalOpen(false)
      setForm({ titulo: '', autor: '', eixo_id: '', status: 'quero', nota: 0 })
      startTransition(() => router.refresh())
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Biblioteca</h1>
          <p className="text-sm text-muted-foreground mt-1">{livros.length} livros registrados</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Registrar livro
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar título ou autor..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring w-56"
          />
        </div>

        <div className="flex gap-1 flex-wrap">
          {ALL_STATUS.map(s => (
            <button
              key={s.value}
              onClick={() => setFiltroStatus(s.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filtroStatus === s.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <select
          value={filtroEixo}
          onChange={e => setFiltroEixo(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
          className="px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="todos">Todos os eixos</option>
          {eixos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Título</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Autor</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Eixo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Nota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  Nenhum livro encontrado
                </td>
              </tr>
            ) : filtered.map(livro => (
              <tr key={livro.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 font-medium">{livro.titulo}</td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{livro.autor ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                  {livro.eixos?.nome ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[livro.status].className}`}>
                    {STATUS_CONFIG[livro.status].label}
                  </span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {livro.nota ? (
                    <span className="text-amber-500 text-xs">
                      {'★'.repeat(livro.nota)}{'☆'.repeat(5 - livro.nota)}
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="bg-background rounded-xl border border-border w-full max-w-md shadow-xl p-6 space-y-5">
            <h2 className="text-lg font-semibold">Registrar livro</h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Título *</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Crime e Castigo"
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Autor</label>
                <input
                  type="text"
                  value={form.autor}
                  onChange={e => setForm(p => ({ ...p, autor: e.target.value }))}
                  placeholder="Ex: Dostoiévski"
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Eixo</label>
                  <select
                    value={form.eixo_id}
                    onChange={e => setForm(p => ({ ...p, eixo_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Selecionar</option>
                    {eixos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value as Status }))}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.status === 'lido' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nota</label>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(n => (
                      <button
                        key={n}
                        onClick={() => setForm(p => ({ ...p, nota: n }))}
                        className={`text-2xl transition-colors ${n <= form.nota ? 'text-amber-400' : 'text-muted-foreground/30'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarLivro}
                disabled={saving || !form.titulo.trim()}
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
