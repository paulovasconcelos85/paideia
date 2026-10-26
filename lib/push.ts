import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface Notificacao {
  titulo: string
  corpo: string
  url?: string
  tag?: string // notificações com a mesma tag substituem a anterior em vez de empilhar
}

let configurado = false

function configurar() {
  if (configurado) return true
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY
  if (!publica || !privada) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:contato@paideia.app', publica, privada)
  configurado = true
  return true
}

/** Envia para todos os aparelhos inscritos dos usuários. Remove inscrições que expiraram. Retorna quantas foram entregues. */
export async function enviarPush(supabase: SupabaseClient, filtro: { familiaId?: string; userId?: string }, n: Notificacao) {
  if (!configurar()) return 0

  let query = supabase.from('fin_push').select('endpoint, p256dh, auth')
  if (filtro.familiaId) query = query.eq('familia_id', filtro.familiaId)
  if (filtro.userId) query = query.eq('user_id', filtro.userId)
  const { data: inscricoes } = await query

  let entregues = 0
  await Promise.all((inscricoes ?? []).map(async i => {
    try {
      await webpush.sendNotification(
        { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
        JSON.stringify(n),
        { TTL: 60 * 60 * 12 }
      )
      entregues++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await supabase.from('fin_push').delete().eq('endpoint', i.endpoint)
      }
    }
  }))
  return entregues
}
