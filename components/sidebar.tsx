'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BookOpen, CalendarDays, ChevronDown, Feather, LayoutDashboard, Library, LogOut, Menu,
  NotebookPen, Quote, Settings, Users, Wallet, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

// Sempre visíveis, no menu lateral e na barra inferior do celular
const PRINCIPAIS = [
  { href: '/fragmento', label: 'Fragmento', short: 'Notas', icon: Feather },
  { href: '/clube', label: 'Clube', short: 'Clube', icon: Users },
  { href: '/financas', label: 'Finanças', short: 'Finanças', icon: Wallet },
]

// Recolhidos no menu sanduíche
const SECUNDARIOS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/biblioteca', label: 'Biblioteca', icon: Library },
  { href: '/plano', label: 'Plano mensal', icon: CalendarDays },
  { href: '/citacoes', label: 'Citações', icon: Quote },
  { href: '/caderno', label: 'Caderno', icon: NotebookPen },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const secundarioAtivo = SECUNDARIOS.some(({ href }) => pathname.startsWith(href))
  const [maisAberto, setMaisAberto] = useState(secundarioAtivo)
  const [sheetAberto, setSheetAberto] = useState(false)

  // Fecha o menu do celular ao navegar
  useEffect(() => {
    setSheetAberto(false)
  }, [pathname])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const avatar = profile?.avatar_url ? (
    <Image src={profile.avatar_url} alt="" width={32} height={32} className="rounded-full" />
  ) : (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
      {profile?.name?.[0]?.toUpperCase() ?? 'U'}
    </div>
  )

  const linkSecundario = (active: boolean) =>
    `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
      active
        ? 'bg-primary/10 font-medium text-primary'
        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
    }`

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-border bg-background lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Paideia Ekos</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {PRINCIPAIS.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                      : 'text-foreground hover:bg-secondary'
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {label}
                </Link>
              )
            })}
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setMaisAberto(v => !v)}
              aria-expanded={maisAberto}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Menu className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 text-left">Mais</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${maisAberto ? 'rotate-180' : ''}`} />
            </button>

            {maisAberto && (
              <div className="mt-1 space-y-1">
                {SECUNDARIOS.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className={linkSecundario(pathname.startsWith(href))}>
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center gap-3">
            {avatar}
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden">
        {PRINCIPAIS.map(({ href, short, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className={`text-[11px] leading-none ${active ? 'font-medium' : ''}`}>{short}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setSheetAberto(true)}
          className={`flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors ${
            secundarioAtivo ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Menu className="h-5 w-5" />
          <span className="text-[11px] leading-none">Menu</span>
        </button>
      </nav>

      {/* Menu sanduíche do celular */}
      {sheetAberto && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 lg:hidden"
          onClick={e => { if (e.target === e.currentTarget) setSheetAberto(false) }}
        >
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-border bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-3">
                {avatar}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{profile?.name ?? 'Usuário'}</p>
                  <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSheetAberto(false)}
                className="p-2 text-muted-foreground hover:text-foreground"
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-1 border-t border-border pt-3">
              {SECUNDARIOS.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className={linkSecundario(pathname.startsWith(href))}>
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </Link>
              ))}
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
