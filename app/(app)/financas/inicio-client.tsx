'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Play, Plus } from 'lucide-react'
import type { Retrato } from '@/lib/retrato'
import LancamentoSheet from './_components/lancamento-sheet'
import { Capitulo, capitulos } from './_components/capitulos'

interface Props {
  familiaId: string
  userId: string
  retrato: Retrato
}

export default function InicioClient({ familiaId, userId, retrato }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [lancando, setLancando] = useState(false)
  const [carta, setCarta] = useState(retrato.carta)
  const [escrevendo, setEscrevendo] = useState(false)

  const r = { ...retrato, carta }
  const lista = capitulos(r)

  const passos = [
    { ok: r.setup.rendas, texto: 'Cadastrar as rendas', href: '/financas/rendas' },
    { ok: r.setup.fixos, texto: 'Cadastrar os gastos fixos', href: '/financas/gastos' },
    { ok: r.setup.cartoes, texto: 'Cadastrar os cartões', href: '/financas/gastos' },
    { ok: r.setup.familia, texto: 'Convidar quem divide a casa', href: '/financas/familia' },
    { ok: r.setup.planos, texto: 'Criar o primeiro plano', href: '/financas/planos' },
  ]
  const configurando = passos.some(p => !p.ok)

  async function pedirCarta() {
    setEscrevendo(true)
    try {
      const res = await fetch('/api/financas/carta', { method: 'POST' })
      const data = await res.json()
      if (res.ok) setCarta(data.carta)
      else alert(data.error ?? 'Não foi possível escrever a carta.')
    } finally {
      setEscrevendo(false)
    }
  }

  return (
    <div className="space-y-4 pb-24 lg:pb-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">O retrato das minhas finanças</p>
        <Link
          href="/financas/apresentacao"
          className="flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-sm transition-transform active:scale-95"
        >
          <Play className="h-3.5 w-3.5 fill-current" /> Apresentar
        </Link>
      </div>

      {configurando && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <p className="mb-2 text-sm font-medium">Primeiros passos</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {passos.map(p => (
              <li key={p.texto}>
                <Link href={p.href} className={`flex items-center gap-2 text-sm ${p.ok ? 'text-muted-foreground line-through' : 'hover:text-primary'}`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${p.ok ? 'border-green-600 bg-green-600 text-white' : 'border-border'}`}>
                    {p.ok && <Check className="h-3 w-3" />}
                  </span>
                  {p.texto}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* A capa ocupa a largura toda; os demais capítulos fazem duas colunas no computador */}
      <div className="grid gap-4 lg:grid-cols-2">
        {lista.map(c => (
          <div key={c.id} className={c.id === 'capa' ? 'lg:col-span-2' : ''}>
            <Capitulo id={c.id} r={r} onPedirCarta={pedirCarta} escrevendo={escrevendo} />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setLancando(true)}
        aria-label="Lançar gasto"
        className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-8 lg:right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      {lancando && (
        <LancamentoSheet
          familiaId={familiaId}
          userId={userId}
          cartoes={r.cartoes}
          planoPrincipal={r.planoPrincipal}
          rendaMensal={r.renda}
          onSaved={() => startTransition(() => router.refresh())}
          onClose={() => setLancando(false)}
        />
      )}
    </div>
  )
}
