import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} />
      <main className="flex-1 min-w-0 lg:ml-64 min-h-screen pb-20 lg:pb-0">
        <div className="px-4 py-4 sm:px-6 sm:py-6 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
