import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const redirectWithError = (message: string) => {
    const loginUrl = new URL('/login', origin)
    loginUrl.searchParams.set('error', message)
    return NextResponse.redirect(loginUrl)
  }

  if (error) {
    return redirectWithError(errorDescription ?? error)
  }

  if (!code) {
    return redirectWithError('Codigo de autenticacao ausente.')
  }

  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return redirectWithError(exchangeError.message)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
