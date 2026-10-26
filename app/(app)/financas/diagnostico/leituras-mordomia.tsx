'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LEITURAS_MORDOMIA } from '@/lib/mordomia'

interface Props {
  userId: string
  eixoId: number | null
  titulosNaBiblioteca: string[]
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export default function LeiturasMordomia({ userId, eixoId, titulosNaBiblioteca }: Props) {
  const supabase = createClient()
  const [naBiblioteca, setNaBiblioteca] = useState(new Set(titulosNaBiblioteca.map(normalizar)))
  const [salvando, setSalvando] = useState<string | null>(null)

  async function adicionar(titulo: string, autor: string) {
    setSalvando(titulo)
    const { error } = await supabase.from('livros').insert({ user_id: userId, titulo, autor, eixo_id: eixoId, status: 'quero' })
    setSalvando(null)
    if (!error) setNaBiblioteca(prev => new Set(prev).add(normalizar(titulo)))
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border">
        {LEITURAS_MORDOMIA.map(l => {
          const tem = naBiblioteca.has(normalizar(l.titulo))
          return (
            <li key={l.titulo} className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{l.titulo}</p>
                <p className="text-xs text-muted-foreground">{l.autor} · {l.porque}</p>
              </div>
              <button
                type="button"
                onClick={() => adicionar(l.titulo, l.autor)}
                disabled={tem || salvando === l.titulo}
                className={`flex flex-shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
                  tem ? 'border-green-200 bg-green-50 text-green-700' : 'border-border hover:bg-secondary'
                }`}
              >
                {tem ? <><Check className="h-3 w-3" /> Na estante</> : <><Plus className="h-3 w-3" /> Biblioteca</>}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Os livros entram na <Link href="/biblioteca" className="text-primary hover:underline">Biblioteca</Link> no eixo Mordomia, na fila de leitura.
        As reflexões no Caderno podem nascer daí.
      </p>
    </div>
  )
}
