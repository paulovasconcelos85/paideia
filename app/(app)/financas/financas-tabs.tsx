'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/financas', label: 'Início', ativa: (p: string) => p === '/financas' || p.startsWith('/financas/diagnostico') },
  { href: '/financas/mes', label: 'Mês', ativa: (p: string) => p.startsWith('/financas/mes') },
  { href: '/financas/ano', label: 'Ano', ativa: (p: string) => p.startsWith('/financas/ano') },
  { href: '/financas/patrimonio', label: 'Patrimônio', ativa: (p: string) => p.startsWith('/financas/patrimonio') },
  { href: '/financas/planos', label: 'Planos', ativa: (p: string) => p.startsWith('/financas/planos') },
  { href: '/financas/gastos', label: 'Orçamento', ativa: (p: string) => p.startsWith('/financas/gastos') || p.startsWith('/financas/rendas') },
]

// Dentro de "Orçamento": o que se repete todo mês
const ORCAMENTO = [
  { href: '/financas/gastos', label: 'Gastos fixos' },
  { href: '/financas/rendas', label: 'Rendas' },
]

export default function FinancasTabs() {
  const pathname = usePathname()
  const noOrcamento = pathname.startsWith('/financas/gastos') || pathname.startsWith('/financas/rendas')

  if (pathname.startsWith('/financas/familia')) return null

  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        {TABS.map(({ href, label, ativa }) => {
          const active = ativa(pathname)
          return (
            <Link
              key={href}
              href={href}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
                active
                  ? 'border-primary font-medium text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {noOrcamento && (
        <div className="inline-flex rounded-lg bg-secondary p-1">
          {ORCAMENTO.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                pathname.startsWith(href) ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
