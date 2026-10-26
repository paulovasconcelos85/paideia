'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Estado = 'carregando' | 'sem-suporte' | 'ios-instalar' | 'sem-chave' | 'negado' | 'inativo' | 'ativo'

function chaveParaBytes(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const bruto = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bruto, c => c.charCodeAt(0))
}

export default function AtivarLembretes({ familiaId, userId }: { familiaId: string; userId: string }) {
  const supabase = createClient()
  const [estado, setEstado] = useState<Estado>('carregando')
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
      const instalado = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone
      if (ios && !instalado) return setEstado('ios-instalar') // no iPhone, push só funciona com o app na tela de início
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setEstado('sem-suporte')
      if (!chave) return setEstado('sem-chave')
      if (Notification.permission === 'denied') return setEstado('negado')
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      setEstado(sub ? 'ativo' : 'inativo')
    })().catch(() => setEstado('sem-suporte'))
  }, [chave])

  async function ativar() {
    setOcupado(true)
    setMsg(null)
    try {
      const permissao = await Notification.requestPermission()
      if (permissao !== 'granted') return setEstado(permissao === 'denied' ? 'negado' : 'inativo')
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave!) })
      const json = sub.toJSON()
      const { error } = await supabase.from('fin_push').upsert({
        endpoint: sub.endpoint,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
        user_id: userId,
        familia_id: familiaId,
      })
      if (error) throw error
      setEstado('ativo')
      await fetch('/api/financas/push-teste', { method: 'POST' })
    } catch {
      setMsg('Não foi possível ativar neste aparelho.')
    } finally {
      setOcupado(false)
    }
  }

  async function desativar() {
    setOcupado(true)
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await supabase.from('fin_push').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
    setEstado('inativo')
    setOcupado(false)
  }

  async function testar() {
    setMsg(null)
    const res = await fetch('/api/financas/push-teste', { method: 'POST' })
    if (!res.ok) setMsg((await res.json()).error ?? 'Falhou.')
    else setMsg('Enviado! Deve chegar em alguns segundos.')
  }

  const textos: Partial<Record<Estado, string>> = {
    'sem-suporte': 'Este navegador não recebe notificações.',
    'ios-instalar': 'No iPhone, primeiro adicione o app à tela de início (Safari → Compartilhar → Adicionar à Tela de Início). Depois abra por lá e volte aqui.',
    'sem-chave': 'O servidor ainda não tem as chaves de notificação configuradas.',
    'negado': 'As notificações foram bloqueadas. Libere nas configurações do navegador ou do celular.',
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <Bell className="h-4 w-4 text-primary" /> Lembretes neste aparelho
      </h2>
      <p className="text-sm text-muted-foreground">
        Fatura perto do vencimento, conta que vence amanhã, 13º chegando e a carta do mês.
      </p>

      {estado === 'carregando' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {textos[estado] && <p className="rounded-lg bg-secondary/60 p-3 text-sm">{textos[estado]}</p>}

      {estado === 'inativo' && (
        <button
          type="button"
          onClick={ativar}
          disabled={ocupado}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Ativar lembretes
        </button>
      )}

      {estado === 'ativo' && (
        <div className="flex gap-2">
          <button type="button" onClick={testar} className="flex-1 rounded-lg border border-border py-2.5 text-sm hover:bg-secondary">
            Enviar teste
          </button>
          <button
            type="button"
            onClick={desativar}
            disabled={ocupado}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary"
          >
            <BellOff className="h-4 w-4" /> Desativar
          </button>
        </div>
      )}

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </section>
  )
}
