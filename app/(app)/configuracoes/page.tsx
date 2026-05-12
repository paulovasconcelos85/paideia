import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ConfiguracoesClient from './configuracoes-client'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('anthropic_api_key, ai_perfil, ai_instrucoes')
    .eq('id', user.id)
    .single()

  return (
    <ConfiguracoesClient
      userId={user.id}
      anthropicApiKey={profile?.anthropic_api_key ?? null}
      aiPerfil={profile?.ai_perfil ?? null}
      aiInstrucoes={profile?.ai_instrucoes ?? null}
    />
  )
}
