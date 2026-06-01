'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Check, Eye, EyeOff, ExternalLink, Key, Sparkles, User, Users } from 'lucide-react'
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

const PROVIDERS = [
  { id: 'anthropic', label: 'Claude', hint: 'sk-ant-api03-...', url: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai',    label: 'ChatGPT', hint: 'sk-proj-...', url: 'https://platform.openai.com/api-keys' },
  { id: 'gemini',    label: 'Gemini', hint: 'AIza...', url: 'https://aistudio.google.com/app/apikey' },
] as const

type ProviderId = typeof PROVIDERS[number]['id']

interface Props {
  userId: string
  anthropicApiKey: string | null
  openaiApiKey: string | null
  geminiApiKey: string | null
  aiProvider: string | null
  aiPerfil: string | null
  aiInstrucoes: string | null
  nomeClube: string | null
}

export default function ConfiguracoesClient({ userId, anthropicApiKey, openaiApiKey, geminiApiKey, aiProvider, aiPerfil, aiInstrucoes, nomeClube }: Props) {
  const supabase = createClient()

  const [provider, setProvider] = useState<ProviderId>((aiProvider as ProviderId) ?? 'anthropic')
  const [keys, setKeys] = useState({
    anthropic: anthropicApiKey ?? '',
    openai: openaiApiKey ?? '',
    gemini: geminiApiKey ?? '',
  })
  const [keyVisible, setKeyVisible] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const [keyError, setKeyError] = useState('')

  const [nomeClubVal, setNomeClubVal] = useState(nomeClube ?? '')
  const [nomeClubeErro, setNomeClubeErro] = useState('')
  const [nomeClubesalvo, setNomeClubeSalvo] = useState(false)
  const nomeClubeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [perfil, setPerfil] = useState(aiPerfil ?? '')
  const [instrucoes, setInstrucoes] = useState(aiInstrucoes ?? '')
  const [perfilSalvo, setPerfilSalvo] = useState(false)
  const [instrucoesSalvas, setInstrucoesSalvas] = useState(false)
  const [perfilErro, setPerfilErro] = useState('')
  const [instrucoesErro, setInstrucoesErro] = useState('')

  const perfilTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const instrucoesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const colKey: Record<ProviderId, string> = {
    anthropic: 'anthropic_api_key',
    openai: 'openai_api_key',
    gemini: 'gemini_api_key',
  }

  async function salvarApiKey() {
    setSavingKey(true)
    setKeyError('')
    const { error } = await supabase
      .from('profiles')
      .update({ [colKey[provider]]: keys[provider].trim() || null })
      .eq('id', userId)
    setSavingKey(false)
    if (error) {
      setKeyError('Erro ao salvar. Tente novamente.')
    } else {
      setKeySaved(true)
      setTimeout(() => setKeySaved(false), 3000)
    }
  }

  async function removerApiKey() {
    setKeys(prev => ({ ...prev, [provider]: '' }))
    await supabase.from('profiles').update({ [colKey[provider]]: null }).eq('id', userId)
  }

  async function selecionarProvider(id: ProviderId) {
    setProvider(id)
    setKeyError('')
    await supabase.from('profiles').update({ ai_provider: id }).eq('id', userId)
  }

  function handleNomeClubeChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value.slice(0, 50)
    setNomeClubVal(value)
    setNomeClubeErro('')
    if (nomeClubeTimer.current) clearTimeout(nomeClubeTimer.current)
    nomeClubeTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ nome_clube: value.trim() || null })
        .eq('id', userId)
      if (error) {
        setNomeClubeErro(error.message)
      } else {
        setNomeClubeSalvo(true)
        setTimeout(() => setNomeClubeSalvo(false), 2000)
      }
    }, 800)
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

  const providerAtual = PROVIDERS.find(p => p.id === provider)!
  const temChave = keys[provider].trim().length > 10

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure sua chave da API e como a inteligência artificial deve escrever para você.
        </p>
      </div>

      {/* Provedor de IA */}
      <section className="space-y-5 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">Provedor de IA</h2>
          {temChave && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
              <Check className="h-3 w-3" /> Configurado
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Escolha qual IA vai gerar os textos no Caderno. Cada provedor usa sua própria chave de API.
        </p>

        {/* Seletor de provedor */}
        <div className="grid grid-cols-3 gap-2">
          {PROVIDERS.map(p => {
            const temChaveP = keys[p.id].trim().length > 10
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selecionarProvider(p.id)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors ${
                  provider === p.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                }`}
              >
                <span className="text-sm font-medium">{p.label}</span>
                {temChaveP && (
                  <span className="flex items-center gap-0.5 text-xs text-green-600">
                    <Check className="h-2.5 w-2.5" /> chave
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Campo de chave do provedor selecionado */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Chave da API — {providerAtual.label}</label>
            <a
              href={providerAtual.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
            >
              Obter chave <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <input
                type={keyVisible ? 'text' : 'password'}
                value={keys[provider]}
                onChange={e => setKeys(prev => ({ ...prev, [provider]: e.target.value }))}
                placeholder={providerAtual.hint}
                className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setKeyVisible(prev => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={keyVisible ? 'Ocultar chave' : 'Mostrar chave'}
              >
                {keyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {keyError && <p className="text-xs text-destructive">{keyError}</p>}

            <div className="flex flex-wrap items-center gap-3">
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
              {keys[provider] && (
                <button
                  type="button"
                  onClick={removerApiKey}
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
                >
                  Remover chave
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Suas chaves são armazenadas na sua conta e protegidas pelo banco de dados. Nunca as compartilhe.
        </p>
      </section>

      {/* Identidade no Clube */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">Identidade no Clube</h2>
          {nomeClubesalvo && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> Salvo
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Como você aparece para outros membros ao publicar pensamentos, citações e prosas no Clube.
          Deixe em branco para aparecer como <strong>Anônimo</strong>.
        </p>

        <div className="space-y-1.5">
          <div className="relative">
            <input
              type="text"
              value={nomeClubVal}
              onChange={handleNomeClubeChange}
              placeholder="Ex: Paulo V., Leitor Reformado..."
              maxLength={50}
              className="w-full rounded-md border border-border bg-background px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {nomeClubVal.length}/50
            </span>
          </div>
          {nomeClubeErro && <p className="text-xs text-destructive">{nomeClubeErro}</p>}
        </div>
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
