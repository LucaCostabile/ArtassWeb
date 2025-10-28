import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import logo from '@/assets/logo.png'
import { Lora } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'

const lora = Lora({ subsets: ['latin'], weight: ['400','500','600','700'] })

export const metadata: Metadata = {
  title: 'Artass Rol',
  description: 'Portal de servidor de rol',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return (
    <html lang="es">
      <body className={`${lora.className} font-english bg-stone-950 text-stone-100`}>
        <header className="border-b border-stone-800/70 bg-stone-900/40 backdrop-blur">
          <nav className="container flex h-16 items-center gap-4">
            <Link href="/" className={`flex items-center gap-2 no-underline`}>
              <Image src={logo} alt="Artass" width={28} height={28} className="select-none" />
              <span className="text-xl font-semibold tracking-wide">Artass Rol</span>
            </Link>
            <div className="ml-auto flex gap-4 text-sm items-center">
              <Link href="/dashboard" className="hover:underline">Dashboard</Link>
              <Link href="/admin" className="hover:underline">Admin</Link>
              {user ? (
                <form action="/auth/signout" method="post">
                  <button className="hover:underline">Cerrar sesión</button>
                </form>
              ) : (
                <Link href="/login" className="hover:underline">Iniciar sesión</Link>
              )}
            </div>
          </nav>
        </header>
        <main className="container py-6">{children}</main>
        <footer className="container py-8 text-sm opacity-70">© {new Date().getFullYear()} Artass</footer>
      </body>
    </html>
  )
}
