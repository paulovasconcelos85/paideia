'use client'

import { Fragment, useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

const STORAGE_KEY = 'ekos:ultima-analise'
const CONTEXTO_KEY = 'ekos:contexto'

// Renderiza o subconjunto de markdown pedido no prompt: ##, listas com "- " e **negrito**
function negrito(linha: string) {
  return linha.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**')
      ? <strong key={i}>{parte.slice(2, -2)}</strong>
      : <Fragment key={i}>{parte}</Fragment>
  )
}

function Analise({ texto }: { texto: string }) {
  const blocos: React.ReactNode[] = []
  let lista: string[] = []

  const fecharLista = () => {
    if (lista.length) {
      blocos.push(
        <ul key={`ul-${blocos.length}`} className="list-disc pl-5 space-y-1.5">
          {lista.map((item, i) => <li key={i}>{negrito(item)}</li>)}
        </ul>
      )
      lista = []
    }
  }

  for (const bruta of texto.split('\n')) {
    const linha = bruta.trim()
    if (!linha) { fecharLista(); continue }
    if (linha.startsWith('#')) {
      fecharLista()
      blocos.push(<h3 key={blocos.length} className="text-sm font-semibold pt-2">{linha.replace(/^#+\s*/, '')}</h3>)
    } else if (/^[-*]\s/.test(linha)) {
      lista.push(linha.slice(2))
    } else {
      fecharLista()
      blocos.push(<p key={blocos.length}>{negrito(linha)}</p>)
    }
  }
  fecharLista()

  return <div className="space-y-3 text-sm leading-relaxed">{blocos}</div>
}

export default function ConsultorIA() {
  const [contexto, setContexto] = useState('')
  const [analise, setAnalise] = useState<{ texto: string; data: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY)
      if (salvo) setAnalise(JSON.parse(salvo))
      setContexto(localStorage.getItem(CONTEXTO_KEY) ?? '')
    } catch {
      // sem armazenamento local, segue sem a última análise
    }
  }, [])

  async function analisar() {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/financas/analise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contexto }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar a análise.')
      const nova = { texto: data.analise as string, data: new Date().toISOString() }
      setAnalise(nova)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nova)) } catch { /* ignorado */ }
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-medium">Consultor financeiro com IA</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Analisa cada gasto e renda cadastrados e monta um caminho para sair do vermelho e realizar os planos cadastrados.
            Usa a IA configurada em Configurações. Seus números são enviados ao provedor só no momento da análise.
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground -mb-2">Sobre você (fica salvo neste aparelho para as próximas análises)</p>
      <textarea
        rows={4}
        value={contexto}
        onChange={e => {
          setContexto(e.target.value)
          try { localStorage.setItem(CONTEXTO_KEY, e.target.value) } catch { /* ignorado */ }
        }}
        placeholder="Conte sobre você e o que não está cadastrado. Ex: sou formado em economia, direito e ADS; devo R$ 8.000 no cartão a 12% ao mês; tenho R$ 2.000 guardados; meu filho tem 5 anos..."
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      <button
        type="button"
        onClick={analisar}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? 'Analisando...' : analise ? 'Gerar nova análise' : 'Analisar minhas finanças'}
      </button>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {analise && !loading && (
        <div className="border-t border-border pt-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            Análise de {new Date(analise.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
          <Analise texto={analise.texto} />
        </div>
      )}
    </div>
  )
}
