import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  await supabase.from('plano_livros').delete().eq('user_id', user.id)
  await supabase.from('planos_mensais').delete().eq('user_id', user.id)

  const { data: livro } = await supabase
    .from('livros')
    .select('id, titulo')
    .eq('user_id', user.id)
    .ilike('titulo', '%Somos todos teólogos%')
    .maybeSingle()

  if (!livro) {
    return NextResponse.json(
      { error: 'Livro "Somos todos teólogos" não encontrado na biblioteca.' },
      { status: 404 }
    )
  }

  const { data: novoPlano, error: errPlano } = await supabase
    .from('planos_mensais')
    .insert({
      user_id: user.id,
      numero_mes: 1,
      ano: 2026,
      mes: 6,
      titulo: 'Junho 2026',
      objetivo: null,
    })
    .select('id')
    .single()

  if (errPlano || !novoPlano) {
    return NextResponse.json({ error: errPlano?.message ?? 'Erro ao criar plano.' }, { status: 500 })
  }

  await supabase.from('plano_livros').insert({
    plano_id: novoPlano.id,
    livro_id: livro.id,
    papel: 'principal',
    ordem: 1,
    user_id: user.id,
  })

  return NextResponse.json({
    ok: true,
    mensagem: `Plano resetado. Junho 2026 criado com "${livro.titulo}".`,
  })
}
