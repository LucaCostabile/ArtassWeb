import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Noticias</h1>
      <ul className="space-y-3">
  {(news as NewsItem[] | null ?? []).map((n) => (
          <li key={n.id} className="border border-slate-800 rounded p-3">
            <div className="font-semibold">{n.title}</div>
            <div className="text-sm whitespace-pre-wrap opacity-80">{n.content}</div>
          </li>
        ))}
      </ul>
      <p className="opacity-70">CRUD desde UI pendiente.</p>
    </div>
  )
}
