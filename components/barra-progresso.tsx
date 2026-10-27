'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Barra fina no topo que aparece no instante do clique em um link interno
 * e some quando a nova rota é exibida. Evita a sensação de tela congelada.
 */
export default function BarraProgresso() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [ativa, setAtiva] = useState(false)

  // Rota nova exibida: esconde a barra
  useEffect(() => {
    setAtiva(false)
  }, [pathname, searchParams])

  useEffect(() => {
    function aoClicar(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = (e.target as Element | null)?.closest('a')
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return
      const url = new URL(link.href, location.href)
      if (url.origin !== location.origin) return
      if (url.pathname === location.pathname && url.search === location.search) return
      setAtiva(true)
    }
    document.addEventListener('click', aoClicar)
    return () => document.removeEventListener('click', aoClicar)
  }, [])

  if (!ativa) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-primary/20" role="progressbar" aria-label="Carregando">
      <div className="barra-progresso h-full w-1/3 bg-primary" />
    </div>
  )
}
