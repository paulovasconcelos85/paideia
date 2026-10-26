/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Finanças: ao trocar de aba, sempre buscar os dados atuais (sem o cache de 30 s do roteador)
    staleTimes: { dynamic: 0 },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'zequuczozgzmivioeswu.supabase.co' },
    ],
  },
}

export default nextConfig