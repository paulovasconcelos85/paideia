'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

import type { Emoji } from './constants'

export type PostTipo = 'pensamento' | 'citacao' | 'prosa'

export async function toggleReacao(postTipo: PostTipo, postId: string, emoji: Emoji) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: existente } = await supabase
    .from('clube_reacoes')
    .select('id')
    .eq('user_id', user.id)
    .eq('post_tipo', postTipo)
    .eq('post_id', postId)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existente) {
    await supabase.from('clube_reacoes').delete().eq('id', existente.id)
  } else {
    await supabase.from('clube_reacoes').insert({ user_id: user.id, post_tipo: postTipo, post_id: postId, emoji })
  }

  revalidatePath('/clube')
}
