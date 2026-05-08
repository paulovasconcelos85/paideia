'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Plus, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Eixo, Livro, Status } from '@/lib/types'
import { STATUS_CONFIG } from '@/lib/utils'

const ALL_STATUS: { value: Status | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'lido', label: 'Lidos' },
  { value: 'lendo', label: 'Lendo' },
  { value: 'comprar', label: 'Comprar' },
  { value: 'quero', label: 'Na fila' },
  { value: 'reler', label: 'Reler' },
]

type SortField = 'titulo' | 'autor' | 'status' | 'eixo' | null
type SortDir = 'asc' | 'desc'

interface Props {
  livros: Livro[]
  eixos: Eixo[]
}

interface EditState {
  id: string
  status: Status
  nota: number
  observacoes: string
}

export default function BibliotecaClient({ livros: initial, eixos }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()

  const [livros, setLivros] = useState(initial)
  const [filtroStatus, setFiltroStatus] = useState<Status | 'todos'>('todos')
  const [filtroEixo, setFiltroEixo] = useState<number | 'todos'>('todos')
  const [busca, setBusca] = useState('')
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    titulo: '',
    autor: '',
    eixo_id: '',
    status: 'quero' as Status,
    nota: 0,
  })

  const [editId, setEditId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  function toggleSort(field: Exclude<SortField, null>) {
    if (sortField === field) {
      setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortField(field)
    setSortDir('asc')
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />
    }

    return sortDir === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3 text-primary" />
      : <ArrowDown className="ml-1 h-3 w-3 text-primary" />
  }

  const filtered = useMemo(() => {
    let result = livros.filter(livro => {
      if (filtroStatus !== 'todos' && livro.status !== filtroStatus) return false
      if (filtroEixo !== 'todos' && livro.eixo_id !== filtroEixo) return false

      if (busca) {
        const query = busca.toLowerCase()
        const matchesTitulo = livro.titulo.toLowerCase().includes(query)
        const matchesAutor = (livro.autor ?? '').toLowerCase().includes(query)
        if (!matchesTitulo && !matchesAutor) return false
      }

      return true
    })

    if (sortField) {
      result = [...result].sort((a, b) => {
        let valueA = ''
        let valueB = ''

        if (sortField === 'titulo') {
          valueA = a.titulo
          valueB = b.titulo
        }

        if (sortField === 'autor') {
          valueA = a.autor ?? ''
          valueB = b.autor ?? ''
        }

        if (sortField === 'status') {
          valueA = STATUS_CONFIG[a.status].label
          valueB = STATUS_CONFIG[b.status].label
        }

        if (sortField === 'eixo') {
          valueA = a.eixos?.nome ?? ''
          valueB = b.eixos?.nome ?? ''
        }

        const comparison = valueA.localeCompare(valueB, 'pt-BR')
        return sortDir === 'asc' ? comparison : -comparison
      })
    }

    return result
  }, [livros, filtroStatus, filtroEixo, busca, sortField, sortDir])

  function openEdit(livro: Livro) {
    setEditId(livro.id)
    setEditState({
      id: livro.id,
      status: livro.status,
      nota: livro.nota ?? 0,
      observacoes: livro.observacoes ?? '',
    })
  }

  function cancelEdit() {
    setEditId(null)
    setEditState(null)
  }

  async function saveEdit() {
    if (!editState) return

    setSavingEdit(true)
    const { data, error } = await supabase
      .from('livros')
      .update({
        status: editState.status,
        nota: editState.nota > 0 ? editState.nota : null,
        observacoes: editState.observacoes.trim() || null,
      })
      .eq('id', editState.id)
      .select('*, eixos(*)')
      .single()

    setSavingEdit(false)

    if (!error && data) {
      setLivros(prev => prev.map(livro => (livro.id === data.id ? data as Livro : livro)))
      cancelEdit()
      startTransition(() => router.refresh())
    }
  }

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
        nota: form.nota > 0 ? form.nota : null,
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Biblioteca</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} de {livros.length} livros
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Registrar livro
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar título ou autor..."
            value={busca}
            onChange={event => setBusca(event.target.value)}
            className="w-56 rounded-md border border-border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {ALL_STATUS.map(status => (
            <button
              key={status.value}
              type="button"
              onClick={() => setFiltroStatus(status.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filtroStatus === status.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>

        <select
          value={filtroEixo}
          onChange={event => setFiltroEixo(event.target.value === 'todos' ? 'todos' : Number(event.target.value))}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="todos">Todos os eixos</option>
          {eixos.map(eixo => (
            <option key={eixo.id} value={eixo.id}>
              {eixo.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                <button
                  type="button"
                  className="flex items-center transition-colors hover:text-foreground"
                  onClick={() => toggleSort('titulo')}
                >
                  Título <SortIcon field="titulo" />
                </button>
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                <button
                  type="button"
                  className="flex items-center transition-colors hover:text-foreground"
                  onClick={() => toggleSort('autor')}
                >
                  Autor <SortIcon field="autor" />
                </button>
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                <button
                  type="button"
                  className="flex items-center transition-colors hover:text-foreground"
                  onClick={() => toggleSort('eixo')}
                >
                  Eixo <SortIcon field="eixo" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                <button
                  type="button"
                  className="flex items-center transition-colors hover:text-foreground"
                  onClick={() => toggleSort('status')}
                >
                  Status <SortIcon field="status" />
                </button>
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">Nota</th>
              <th className="w-20 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Nenhum livro encontrado
                </td>
              </tr>
            ) : (
              filtered.map(livro => {
                const isEditing = editId === livro.id

                return (
                  <Fragment key={livro.id}>
                    <tr
                      className={`transition-colors ${
                        isEditing ? 'bg-secondary/40' : 'cursor-pointer hover:bg-secondary/30'
                      }`}
                      onClick={() => {
                        if (!isEditing) openEdit(livro)
                      }}
                    >
                      <td className="px-4 py-3 font-medium">{livro.titulo}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {livro.autor ?? '—'}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                        {livro.eixos?.nome ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing && editState ? (
                          <select
                            value={editState.status}
                            onChange={event =>
                              setEditState(state =>
                                state ? { ...state, status: event.target.value as Status } : state
                              )
                            }
                            onClick={event => event.stopPropagation()}
                            className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {Object.entries(STATUS_CONFIG).map(([key, value]) => (
                              <option key={key} value={key}>
                                {value.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              STATUS_CONFIG[livro.status].className
                            }`}
                          >
                            {STATUS_CONFIG[livro.status].label}
                          </span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        {isEditing && editState ? (
                          <div className="flex gap-0.5" onClick={event => event.stopPropagation()}>
                            {[1, 2, 3, 4, 5].map(nota => (
                              <button
                                key={nota}
                                type="button"
                                onClick={() =>
                                  setEditState(state => (state ? { ...state, nota } : state))
                                }
                                className={`text-lg transition-colors ${
                                  nota <= editState.nota ? 'text-amber-400' : 'text-muted-foreground/30'
                                }`}
                                aria-label={`Definir nota ${nota}`}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                        ) : livro.nota ? (
                          <span className="text-xs text-amber-500">
                            {'★'.repeat(livro.nota)}
                            {'☆'.repeat(5 - livro.nota)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={event => event.stopPropagation()}>
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={savingEdit}
                              className="rounded bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                              aria-label="Salvar edicao"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded border border-border p-1.5 transition-colors hover:bg-secondary"
                              aria-label="Cancelar edicao"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEdit(livro)}
                            className="text-xs text-primary opacity-70 transition-opacity hover:opacity-100"
                          >
                            editar
                          </button>
                        )}
                      </td>
                    </tr>

                    {isEditing && editState && (
                      <tr className="bg-secondary/20">
                        <td colSpan={6} className="px-4 py-3">
                          <textarea
                            rows={2}
                            value={editState.observacoes}
                            onChange={event =>
                              setEditState(state =>
                                state ? { ...state, observacoes: event.target.value } : state
                              )
                            }
                            placeholder="Observações, anotações rápidas sobre o livro..."
                            className="min-h-20 w-full resize rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            onClick={event => event.stopPropagation()}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={event => {
            if (event.target === event.currentTarget) setModalOpen(false)
          }}
        >
          <div className="w-full max-w-md space-y-5 rounded-xl border border-border bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Registrar livro</h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Título *</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={event => setForm(prev => ({ ...prev, titulo: event.target.value }))}
                  placeholder="Ex: Crime e Castigo"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Autor</label>
                <input
                  type="text"
                  value={form.autor}
                  onChange={event => setForm(prev => ({ ...prev, autor: event.target.value }))}
                  placeholder="Ex: Dostoiévski"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Eixo</label>
                  <select
                    value={form.eixo_id}
                    onChange={event => setForm(prev => ({ ...prev, eixo_id: event.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Selecionar</option>
                    {eixos.map(eixo => (
                      <option key={eixo.id} value={eixo.id}>
                        {eixo.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={form.status}
                    onChange={event =>
                      setForm(prev => ({ ...prev, status: event.target.value as Status }))
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {Object.entries(STATUS_CONFIG).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.status === 'lido' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nota</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(nota => (
                      <button
                        key={nota}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, nota }))}
                        className={`text-2xl transition-colors ${
                          nota <= form.nota ? 'text-amber-400' : 'text-muted-foreground/30'
                        }`}
                        aria-label={`Definir nota ${nota}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarLivro}
                disabled={saving || !form.titulo.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
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
