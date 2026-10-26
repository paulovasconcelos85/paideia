'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/financas', label: 'Resumo' },
  { href: '/financas/gastos', label: 'Gastos' },
  { href: '/financas/rendas', label: 'Rendas' },
  { href: '/financas/planos', label: 'Planos' },
]

export default function FinancasTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 border-b border-border overflow-x-auto">
      {TABS.map(({ href, label }) => {
        const active = href === '/financas' ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm transition-colors ${
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
  )
}
