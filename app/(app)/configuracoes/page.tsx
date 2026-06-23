import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ConfiguracoesClient from './configuracoes-client'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <ConfiguracoesClient
      userId={user.id}
      anthropicApiKey={profile?.anthropic_api_key ?? null}
      openaiApiKey={profile?.openai_api_key ?? null}
      geminiApiKey={profile?.gemini_api_key ?? null}
      aiProvider={profile?.ai_provider ?? null}
      aiPerfil={profile?.ai_perfil ?? null}
      aiInstrucoes={profile?.ai_instrucoes ?? null}
      nomeClube={profile?.nome_clube ?? null}
      dataNascimento={profile?.data_nascimento ?? null}
    />
  )
}
