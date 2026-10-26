'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Copy, Share2, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AtivarLembretes from './ativar-lembretes'

export interface Membro {
  user_id: string
  nome: string | null
  email: string | null
  avatar_url: string | null
  papel: 'titular' | 'membro'
}

interface Props {
  familiaId: string
  userId: string
  nome: string
  membros: Membro[]
}

export default function FamiliaClient({ familiaId, userId, nome: nomeInicial, membros }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [nome, setNome] = useState(nomeInicial)
  const [convite, setConvite] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [carregando, setCarregando] = useState(false)

  const textoConvite = convite
    ? `Vamos cuidar das finanças da família juntos no Paideia Ekos. Entre com sua conta Google em ${typeof window !== 'undefined' ? window.location.origin : ''}/financas/familia e use o código ${convite}`
    : ''

  async function salvarNome() {
    if (!nome.trim() || nome === nomeInicial) return
    await supabase.from('fin_familias').update({ nome: nome.trim() }).eq('id', familiaId)
    router.refresh()
  }

  async function gerarConvite() {
    setCarregando(true)
    const { data, error } = await supabase.rpc('fin_criar_convite')
    setCarregando(false)
    if (error) return setMsg({ tipo: 'erro', texto: 'Não foi possível gerar o convite.' })
    setConvite(data as string)
  }

  async function compartilhar() {
    if (navigator.share) {
      try { await navigator.share({ text: textoConvite }) } catch { /* cancelado */ }
    } else {
      await navigator.clipboard.writeText(textoConvite)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    }
  }

  async function entrar() {
    if (!codigo.trim()) return
    setCarregando(true)
    setMsg(null)
    const { error } = await supabase.rpc('fin_entrar_familia', { p_codigo: codigo })
    setCarregando(false)
    if (error) return setMsg({ tipo: 'erro', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Pronto! Agora vocês compartilham as mesmas finanças.' })
    router.push('/financas')
    router.refresh()
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <Link href="/financas" className="text-sm text-muted-foreground hover:text-foreground">← Início</Link>
        <input
          value={nome}
          onChange={e => setNome(e.target.value)}
          onBlur={salvarNome}
          className="mt-1 w-full bg-transparent text-lg font-semibold focus:outline-none border-b border-transparent focus:border-border"
        />
        <p className="text-sm text-muted-foreground">Todos aqui veem e lançam nos mesmos números.</p>
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {membros.map(m => (
          <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
            {m.avatar_url ? (
              <Image src={m.avatar_url} alt="" width={36} height={36} className="rounded-full" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
                {m.nome?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.nome ?? m.email}{m.user_id === userId && ' (você)'}</p>
              <p className="truncate text-xs text-muted-foreground">{m.email}</p>
            </div>
          </li>
        ))}
      </ul>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium"><UserPlus className="h-4 w-4 text-primary" /> Convidar alguém</h2>
        {convite ? (
          <>
            <p className="text-center text-3xl font-semibold tracking-[0.3em]">{convite}</p>
            <p className="text-center text-xs text-muted-foreground">Vale por 7 dias e para uma pessoa.</p>
            <button
              type="button"
              onClick={compartilhar}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground"
            >
              {copiado ? <Check className="h-4 w-4" /> : typeof navigator !== 'undefined' && 'share' in navigator ? <Share2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiado ? 'Copiado!' : 'Enviar convite'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Gere um código e mande pelo WhatsApp. A pessoa entra com a conta Google dela e digita o código aqui.
            </p>
            <button
              type="button"
              onClick={gerarConvite}
              disabled={carregando}
              className="w-full rounded-lg border border-border py-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
            >
              Gerar código de convite
            </button>
          </>
        )}
      </section>

      <AtivarLembretes familiaId={familiaId} userId={userId} />

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-medium">Recebeu um código?</h2>
        <div className="flex gap-2">
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-center text-lg tracking-[0.3em] uppercase focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={entrar}
            disabled={carregando || codigo.length < 6}
            className="rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Entrar
          </button>
        </div>
        {msg && <p className={`text-sm ${msg.tipo === 'erro' ? 'text-red-600' : 'text-green-700'}`}>{msg.texto}</p>}
      </section>
    </div>
  )
}
