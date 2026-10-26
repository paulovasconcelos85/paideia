'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Retrato } from '@/lib/retrato'
import { Capitulo, capitulos } from '../_components/capitulos'

/** Modo apresentação: um capítulo por tela, para ler junto com a família. */
export default function Apresentacao({ retrato }: { retrato: Retrato }) {
  const router = useRouter()
  const lista = capitulos(retrato)
  const [i, setI] = useState(0)
  const toque = useRef<number | null>(null)

  const ir = useCallback((delta: number) => {
    setI(atual => {
      const proximo = atual + delta
      if (proximo >= lista.length) {
        router.push('/financas')
        return atual
      }
      return Math.max(proximo, 0)
    })
  }, [lista.length, router])

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') ir(1)
      if (e.key === 'ArrowLeft') ir(-1)
      if (e.key === 'Escape') router.push('/financas')
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [ir, router])

  const ultimo = i === lista.length - 1

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-secondary/60 to-background"
      onTouchStart={e => { toque.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (toque.current === null) return
        const dx = e.changedTouches[0].clientX - toque.current
        if (Math.abs(dx) > 50) ir(dx < 0 ? 1 : -1)
        toque.current = null
      }}
    >
      {/* Progresso e saída */}
      <div className="flex items-center gap-3 px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="flex flex-1 gap-1.5">
          {lista.map((c, idx) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setI(idx)}
              aria-label={c.titulo}
              className={`h-1.5 flex-1 rounded-full transition-colors ${idx <= i ? 'bg-primary' : 'bg-border'}`}
            />
          ))}
        </div>
        <button type="button" onClick={() => router.push('/financas')} className="-mr-2 p-2 text-muted-foreground hover:text-foreground" aria-label="Fechar apresentação">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* O capítulo */}
      <div className="flex flex-1 items-center overflow-y-auto px-4 py-6">
        <div key={lista[i].id} className="slide-in mx-auto w-full max-w-xl">
          <Capitulo id={lista[i].id} r={retrato} />
        </div>
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between gap-3 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => ir(-1)}
          disabled={i === 0}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background disabled:opacity-30"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-sm text-muted-foreground">
          {lista[i].titulo} · {i + 1} de {lista.length}
        </p>
        <button
          type="button"
          onClick={() => ir(1)}
          className="flex h-12 items-center justify-center gap-1 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
          aria-label={ultimo ? 'Concluir' : 'Próximo'}
        >
          {ultimo ? 'Concluir' : <ChevronRight className="h-5 w-5" />}
        </button>
      </div>
    </div>
  )
}
