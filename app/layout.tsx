import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Paideia Reformada',
  description: 'Biblioteca de formação intelectual cristã',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geist.className} min-h-screen bg-background text-foreground antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
