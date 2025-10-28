import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function AdminIndex() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!me?.is_admin) redirect('/dashboard')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Panel de administración</h1>
      <ul className="list-disc pl-6 space-y-2">
        <li><Link className="underline" href="/admin/users">Gestionar usuarios</Link></li>
        <li><Link className="underline" href="/admin/characters">Gestionar personajes</Link></li>
        <li><Link className="underline" href="/admin/news">Gestionar noticias</Link></li>
      </ul>
    </div>
  )
}
