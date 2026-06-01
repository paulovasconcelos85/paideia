'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpen, CalendarDays, LayoutDashboard, Library, LogOut, NotebookPen, Quote, Settings, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', short: 'Início', icon: LayoutDashboard },
  { href: '/biblioteca', label: 'Biblioteca', short: 'Livros', icon: Library },
  { href: '/plano', label: 'Plano mensal', short: 'Plano', icon: CalendarDays },
  { href: '/citacoes', label: 'Citações', short: 'Citações', icon: Quote },
  { href: '/caderno', label: 'Caderno', short: 'Caderno', icon: NotebookPen },
  { href: '/clube', label: 'Clube', short: 'Clube', icon: Users },
  { href: '/configuracoes', label: 'Configurações', short: 'Config', icon: Settings },
]

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-border bg-background lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Paideia Reformada</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)

            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center gap-3">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} alt="" width={32} height={32} className="rounded-full" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                {profile?.name?.[0]?.toUpperCase() ?? 'U'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile?.name ?? 'Usuário'}</p>
              <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Bottom nav mobile/tablet */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-background lg:hidden">
        {NAV.map(({ href, short, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] leading-none">{short}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
