import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Paideia Ekos',
    short_name: 'Paideia',
    description: 'Fragmentos, leituras, reflexões e finanças da família',
    start_url: '/fragmento',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    lang: 'pt-BR',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Novo fragmento', url: '/fragmento' },
      { name: 'Caderno', url: '/caderno' },
      { name: 'Finanças', url: '/financas' },
    ],
  }
}
