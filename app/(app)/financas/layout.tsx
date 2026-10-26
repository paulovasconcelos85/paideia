import Link from 'next/link'
import { Users } from 'lucide-react'
import FinancasTabs from './financas-tabs'

export default function FinancasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Finanças</h1>
        <Link
          href="/financas/familia"
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Users className="h-3.5 w-3.5" /> Família
        </Link>
      </div>
      <FinancasTabs />
      {children}
    </div>
  )
}
