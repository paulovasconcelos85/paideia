import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enviarPush } from '@/lib/push'

// Manda uma notificação de teste para os aparelhos do próprio usuário
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ error: 'As chaves VAPID ainda não foram configuradas no servidor.' }, { status: 500 })
  }

  const entregues = await enviarPush(supabase, { userId: user.id }, {
    titulo: 'Lembretes ativados ✓',
    corpo: 'Você vai ser avisado de faturas, contas e da carta do mês.',
    url: '/financas',
    tag: 'teste',
  })
  if (entregues === 0) return NextResponse.json({ error: 'Nenhum aparelho recebeu. Ative os lembretes de novo.' }, { status: 400 })
  return NextResponse.json({ entregues })
}
