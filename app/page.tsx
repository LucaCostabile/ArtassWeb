import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import banner from '@/assets/Banner.png'
import Title from '@/components/Title'

export default async function HomePage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  type NewsItem = { id: string; title: string; content: string; created_at: string }
  let news: NewsItem[] = []
  if (user) {
    const { data } = await supabase
      .from('news')
      .select('id, title, content, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
    news = (data as NewsItem[] | null) ?? []
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Title>Bienvenido al mundo de Artass</Title>
      </div>

      {/* Banner primero */}
      <div className="rounded overflow-hidden border border-stone-800/70">
        <Image src={banner} alt="Banner Artass" priority className="w-full h-auto object-cover" />
      </div>

      <p className="opacity-85">
        Este es el portal para gestionar los personajes de rol y la organización del mundo de Artass.
      </p>

      {!user && (
        <p>
          Para ver noticias y tu información, por favor <Link className="underline" href="/login">iniciá sesión</Link>.
        </p>
      )}

      {user && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Noticias</h2>
          <ul className="space-y-3">
            {(news ?? []).map((n) => (
              <li key={n.id} className="signboard p-4">
                <h3 className="text-lg font-semibold">{n.title}</h3>
                <p className="opacity-90 whitespace-pre-wrap">{n.content}</p>
                <div className="text-xs opacity-60 mt-2">{new Date(n.created_at).toLocaleString('es-AR')}</div>
              </li>
            ))}
            {news.length === 0 && (
              <li className="opacity-70">No hay noticias aún.</li>
            )}
          </ul>
        </section>
      )}
    </div>
  )
}
