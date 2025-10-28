import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Title from '@/components/Title'

export default async function AdminNews() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!me?.is_admin) redirect('/dashboard')

  type NewsItem = { id: string; title: string; content: string; created_at: string }
  const { data: news } = await supabase
    .from('news')
    .select('id, title, content, created_at')
    .order('created_at', { ascending: false })

  async function createNews(formData: FormData) {
    'use server'
    const supa = createClient()
    const { data: { user: u } } = await supa.auth.getUser()
    if (!u) redirect('/login')
    const { data: me2 } = await supa.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
    if (!me2?.is_admin) redirect('/dashboard')

    const title = String(formData.get('title') || '').trim()
    const content = String(formData.get('content') || '').trim()
    if (!title || !content) throw new Error('Título y contenido son obligatorios')

    const { error } = await supa.from('news').insert({ title, content, author: u.id })
    if (error) throw error
    revalidatePath('/admin/news')
  }

  async function updateNews(formData: FormData) {
    'use server'
    const supa = createClient()
    const { data: { user: u } } = await supa.auth.getUser()
    if (!u) redirect('/login')
    const { data: me2 } = await supa.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
    if (!me2?.is_admin) redirect('/dashboard')

    const id = String(formData.get('id') || '')
    const title = String(formData.get('title') || '').trim()
    const content = String(formData.get('content') || '').trim()
    if (!id) throw new Error('ID requerido')
    if (!title || !content) throw new Error('Título y contenido son obligatorios')

    const { error } = await supa.from('news').update({ title, content }).eq('id', id)
    if (error) throw error
    revalidatePath('/admin/news')
  }

  async function deleteNews(formData: FormData) {
    'use server'
    const supa = createClient()
    const { data: { user: u } } = await supa.auth.getUser()
    if (!u) redirect('/login')
    const { data: me2 } = await supa.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
    if (!me2?.is_admin) redirect('/dashboard')

    const id = String(formData.get('id') || '')
    if (!id) throw new Error('ID requerido')
    const { error } = await supa.from('news').delete().eq('id', id)
    if (error) throw error
    revalidatePath('/admin/news')
  }

  return (
    <div className="space-y-4">
      <Title>Noticias</Title>
      <section className="tavern-panel p-4">
        <h2 className="font-semibold mb-2">Crear noticia</h2>
        <form action={createNews} className="grid gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Título</span>
            <input name="title" required className="bg-transparent border border-stone-700 rounded px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Contenido</span>
            <textarea name="content" rows={5} required className="bg-transparent border border-stone-700 rounded px-2 py-1" />
          </label>
          <div>
            <button className="border border-stone-700 rounded px-3 py-1">Publicar</button>
          </div>
        </form>
      </section>
      <ul className="space-y-3">
  {(news as NewsItem[] | null ?? []).map((n) => (
          <li key={n.id} className="tavern-panel p-3 space-y-2">
            <form action={updateNews} className="grid gap-2">
              <input type="hidden" name="id" value={n.id} />
              <label className="flex flex-col gap-1">
                <span className="text-xs opacity-70">Título</span>
                <input name="title" defaultValue={n.title} className="bg-transparent border border-stone-700 rounded px-2 py-1" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs opacity-70">Contenido</span>
                <textarea name="content" defaultValue={n.content} rows={4} className="bg-transparent border border-stone-700 rounded px-2 py-1" />
              </label>
              <div><button className="border border-stone-700 rounded px-3 py-1">Guardar</button></div>
            </form>
            <form action={deleteNews}>
              <input type="hidden" name="id" value={n.id} />
              <button className="border border-red-700 text-red-300 rounded px-3 py-1">Eliminar</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  )
}
