import { createClient, getUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Sidebar from '@/components/sidebar'
import BarraProgresso from '@/components/barra-progresso'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen">
      <Suspense>
        <BarraProgresso />
      </Suspense>
      <Sidebar profile={profile} />
      <main className="flex-1 min-w-0 lg:ml-64 min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] lg:pb-0">
        <div className="px-4 py-4 sm:px-6 sm:py-6 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
