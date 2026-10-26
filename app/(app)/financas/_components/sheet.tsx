'use client'

import { X } from 'lucide-react'

interface Props {
  titulo: string
  onClose: () => void
  children: React.ReactNode
}

/** Janela que sobe de baixo no celular e fica centralizada no computador. */
export default function Sheet({ titulo, onClose, children }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="max-h-[92vh] w-full space-y-5 overflow-y-auto rounded-t-2xl border border-border bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:max-w-lg sm:rounded-xl sm:p-6">
        <div className="mx-auto -mt-2 h-1 w-10 rounded-full bg-border sm:hidden" />
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button type="button" onClick={onClose} className="-mr-2 p-2 text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
