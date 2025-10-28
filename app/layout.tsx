import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Artass Rol',
  description: 'Portal de servidor de rol',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="border-b border-slate-800">
          <nav className="container flex h-14 items-center gap-4">
            <Link href="/" className="font-semibold">Artass Rol</Link>
            <div className="ml-auto flex gap-3">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/admin">Admin</Link>
            </div>
          </nav>
        </header>
        <main className="container py-6">{children}</main>
        <footer className="container py-6 text-sm opacity-60">© {new Date().getFullYear()} Artass</footer>
      </body>
    </html>
  )
}
