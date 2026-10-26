import type { SupabaseClient } from '@supabase/supabase-js'

export interface AiConfig {
  provider: string
  apiKey: string
  aiPerfil: string | null
  aiInstrucoes: string | null
}

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: 'Claude (Anthropic)',
  openai: 'ChatGPT (OpenAI)',
  gemini: 'Gemini (Google)',
}

/** Lê o provedor e a chave configurados pelo usuário. Retorna { error } se faltar a chave. */
export async function carregarAiConfig(
  supabase: SupabaseClient,
  userId: string
): Promise<AiConfig | { error: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('anthropic_api_key, openai_api_key, gemini_api_key, ai_provider, ai_perfil, ai_instrucoes')
    .eq('id', userId)
    .single()

  const provider = profile?.ai_provider ?? 'anthropic'
  const keyMap: Record<string, string | null | undefined> = {
    anthropic: profile?.anthropic_api_key,
    openai: profile?.openai_api_key,
    gemini: profile?.gemini_api_key,
  }
  const apiKey = keyMap[provider]?.trim()

  if (!apiKey) {
    return { error: `Chave da API ${PROVIDER_LABEL[provider] ?? provider} não configurada. Acesse Configurações.` }
  }

  return {
    provider,
    apiKey,
    aiPerfil: profile?.ai_perfil ?? null,
    aiInstrucoes: profile?.ai_instrucoes ?? null,
  }
}

/** Chama o provedor configurado e devolve o texto gerado. Lança Error com mensagem amigável. */
export async function gerarTexto(
  config: AiConfig,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4000
): Promise<string> {
  const { provider, apiKey } = config

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    })
    if (!res.ok) throw new Error(`Erro na API OpenAI: ${await res.text()}`)
    const d = await res.json()
    return d.choices?.[0]?.message?.content ?? ''
  }

  if (provider === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      }
    )
    if (!res.ok) throw new Error(`Erro na API Gemini: ${await res.text()}`)
    const d = await res.json()
    return d.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }

  // Anthropic (padrão)
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5'
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) throw new Error(`Erro na API Claude: ${await res.text()}`)
  const d = await res.json()
  return d.content?.find((p: { type?: string }) => p.type === 'text')?.text ?? ''
}
