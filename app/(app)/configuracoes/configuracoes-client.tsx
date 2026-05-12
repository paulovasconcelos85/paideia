'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Check, Eye, EyeOff, ExternalLink, Key, Sparkles, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const PERFIS_RAPIDOS = [
  'Reformado',
  'Evangélico',
  'Católico',
  'Conservador',
  'Progressista',
  'Secular',
  'Presbiteriano',
  'Batista',
  'Luterano',
  'Liberal',
]

interface Props {
  userId: string
  anthropicApiKey: string | null
  aiPerfil: string | null
  aiInstrucoes: string | null
}

export default function ConfiguracoesClient({ userId, anthropicApiKey, aiPerfil, aiInstrucoes }: Props) {
  const supabase = createClient()

  const [apiKey, setApiKey] = useState(anthropicApiKey ?? '')
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const [keyError, setKeyError] = useState('')

  const [perfil, setPerfil] = useState(aiPerfil ?? '')
  const [instrucoes, setInstrucoes] = useState(aiInstrucoes ?? '')
  const [perfilSalvo, setPerfilSalvo] = useState(false)
  const [instrucoesSalvas, setInstrucoesSalvas] = useState(false)
  const [perfilErro, setPerfilErro] = useState('')
  const [instrucoesErro, setInstrucoesErro] = useState('')

  const perfilTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const instrucoesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function salvarApiKey() {
    setSavingKey(true)
    setKeyError('')

    const { error } = await supabase
      .from('profiles')
      .update({ anthropic_api_key: apiKey.trim() || null })
      .eq('id', userId)

    setSavingKey(false)

    if (error) {
      setKeyError('Erro ao salvar. Tente novamente.')
    } else {
      setKeySaved(true)
      setTimeout(() => setKeySaved(false), 3000)
    }
  }

  function handlePerfilChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value
    setPerfil(value)
    setPerfilErro('')
    if (perfilTimer.current) clearTimeout(perfilTimer.current)
    perfilTimer.current = setTimeout(async () => {
      const { error } = await supabase.from('profiles').update({ ai_perfil: value.trim() || null }).eq('id', userId)
      if (error) {
        setPerfilErro(error.message)
      } else {
        setPerfilSalvo(true)
        setTimeout(() => setPerfilSalvo(false), 2000)
      }
    }, 800)
  }

  function handleInstrucoesChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value
    setInstrucoes(value)
    setInstrucoesErro('')
    if (instrucoesTimer.current) clearTimeout(instrucoesTimer.current)
    instrucoesTimer.current = setTimeout(async () => {
      const { error } = await supabase.from('profiles').update({ ai_instrucoes: value.trim() || null }).eq('id', userId)
      if (error) {
        setInstrucoesErro(error.message)
      } else {
        setInstrucoesSalvas(true)
        setTimeout(() => setInstrucoesSalvas(false), 2000)
      }
    }, 800)
  }

  function adicionarTag(tag: string) {
    const novo = perfil.trim() ? `${perfil.trim()}, ${tag}` : tag
    setPerfil(novo)
    setPerfilErro('')
    if (perfilTimer.current) clearTimeout(perfilTimer.current)
    perfilTimer.current = setTimeout(async () => {
      const { error } = await supabase.from('profiles').update({ ai_perfil: novo }).eq('id', userId)
      if (error) {
        setPerfilErro(error.message)
      } else {
        setPerfilSalvo(true)
        setTimeout(() => setPerfilSalvo(false), 2000)
      }
    }, 800)
  }

  const temChave = apiKey.trim().startsWith('sk-ant-')

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure sua chave da API e como a inteligência artificial deve escrever para você.
        </p>
      </div>

      {/* Chave da API */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">Chave da API Anthropic</h2>
          {temChave && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
              <Check className="h-3 w-3" /> Configurada
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          A geração de texto no Caderno usa sua própria chave da API Anthropic. Cada usuário é responsável
          pelo seu uso e custo.{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
          >
            Obter chave <ExternalLink className="h-3 w-3" />
          </a>
        </p>

        <div className="space-y-2">
          <div className="relative">
            <input
              type={apiKeyVisible ? 'text' : 'password'}
              value={apiKey}
              onChange={event => setApiKey(event.target.value)}
              placeholder="sk-ant-api03-..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setApiKeyVisible(prev => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={apiKeyVisible ? 'Ocultar chave' : 'Mostrar chave'}
            >
              {apiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {keyError && <p className="text-xs text-destructive">{keyError}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={salvarApiKey}
              disabled={savingKey}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {savingKey ? 'Salvando...' : 'Salvar chave'}
            </button>
            {keySaved && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check className="h-4 w-4" /> Salvo
              </span>
            )}
            {apiKey && (
              <button
                type="button"
                onClick={() => {
                  setApiKey('')
                  supabase.from('profiles').update({ anthropic_api_key: null }).eq('id', userId)
                }}
                className="text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
              >
                Remover chave
              </button>
            )}
          </div>
        </div>

        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Sua chave é armazenada na sua conta e protegida pelo controle de acesso do banco de dados.
          Nunca a compartilhe com ninguém.
        </p>
      </section>

      {/* Perfil do leitor */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">Perfil do leitor</h2>
          {perfilSalvo && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> Salvo
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Descreva quem você é: sua visão de mundo, valores, tradição intelectual e interesses. A IA usará
          isso para escrever de acordo com o seu perfil.
        </p>

        <div className="flex flex-wrap gap-2">
          {PERFIS_RAPIDOS.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => adicionarTag(tag)}
              className="rounded-full border border-border px-3 py-1 text-xs transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
            >
              + {tag}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <textarea
            rows={4}
            value={perfil}
            onChange={handlePerfilChange}
            placeholder="Ex: Cristão reformado, conservador, presbiteriano, leitor de teologia clássica, filosofia política e literatura ocidental. Valorizo a tradição intelectual da Reforma e o pensamento conservador."
            className="w-full resize rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {perfilErro && <p className="text-xs text-destructive">{perfilErro}</p>}
        </div>
      </section>

      {/* Instruções para geração */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">Instruções para geração de texto</h2>
          {instrucoesSalvas && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> Salvo
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Instruções específicas sobre como a IA deve escrever: estilo, vocabulário, tom, referências,
          o que evitar, etc.
        </p>

        <div className="space-y-1.5">
          <textarea
            rows={5}
            value={instrucoes}
            onChange={handleInstrucoesChange}
            placeholder={`Ex:
- Preserve o vocabulário teológico reformado (soberania, graça, aliança, eleição)
- Quando relevante, cite ou alude a Calvino, Agostinho, Kuyper ou Bavinck
- Escreva para um leitor culto mas não especialista
- Evite linguagem de autoajuda ou terapêutica
- O tom deve ser sério e contemplativo, não emocional`}
            className="w-full resize rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {instrucoesErro && <p className="text-xs text-destructive">{instrucoesErro}</p>}
        </div>
      </section>
    </div>
  )
}
