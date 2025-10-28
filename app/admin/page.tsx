import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Title from '@/components/Title'

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
    <div className="space-y-6">
      <Title>Panel de administración</Title>
      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/admin/users" className="tavern-panel p-5 hover:brightness-110 transition block">
          <div className="text-2xl font-semibold">Usuarios</div>
          <div className="opacity-80">Crear, editar y asignar contraseñas.</div>
        </Link>
        <Link href="/admin/characters" className="tavern-panel p-5 hover:brightness-110 transition block">
          <div className="text-2xl font-semibold">Personajes</div>
          <div className="opacity-80">Listado, filtros, pagos semanales, ítems.</div>
        </Link>
        <Link href="/admin/news" className="tavern-panel p-5 hover:brightness-110 transition block sm:col-span-2">
          <div className="text-2xl font-semibold">Noticias</div>
          <div className="opacity-80">Crear y mantener anuncios del servidor.</div>
        </Link>
      </div>
    </div>
  )
}
