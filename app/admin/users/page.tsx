import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import ConfirmButton from '@/components/ConfirmButton'
import Title from '@/components/Title'

export default async function AdminUsers({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!me?.is_admin) redirect('/dashboard')

  type ProfileRow = { id: string; name: string | null; discord_id: string | null; character_limit: number; is_admin: boolean; created_at: string }
  const { data: users } = await supabase
    .from('profiles')
    .select('id, name, discord_id, character_limit, is_admin, created_at')
    .order('created_at', { ascending: false })

  // Obtener emails desde Auth con Service Role y mapear por ID
  const admin = createAdminClient()
  const authList = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const emailById = new Map<string, string>()
  if (!authList.error) {
    for (const u of authList.data.users) {
      if (u.id && u.email) emailById.set(u.id, u.email)
    }
  }

  async function createUser(formData: FormData) {
    'use server'
    const supa = createClient()
    const { data: { user: u } } = await supa.auth.getUser()
    if (!u) redirect('/login')
    const { data: me2 } = await supa.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
    if (!me2?.is_admin) redirect('/dashboard')

    const email = String(formData.get('email') || '').trim().toLowerCase()
    const name = String(formData.get('name') || '').trim()
    const discord_id = String(formData.get('discord_id') || '').trim()
    const character_limit = Number(formData.get('character_limit') || 4)
    const is_admin = formData.get('is_admin') === 'on'

    if (!name || Number.isNaN(character_limit)) {
      throw new Error('Nombre y Límite de personajes son obligatorios')
    }
    function slugify(s: string) {
      return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'user'
    }
    function randomId(n = 6) {
      const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
      let out = ''
      for (let i=0;i<n;i++) out += chars[Math.floor(Math.random()*chars.length)]
      return out
    }
    const finalEmail = email || `${slugify(name)}-${randomId()}@users.artass.local`
    const tempPassword = `${randomId(4)}-${randomId(4)}-${randomId(4)}`

    try {
      const admin = createAdminClient()
      // Crear usuario sin verificación de correo (email_confirm)
      const created = await admin.auth.admin.createUser({
        email: finalEmail,
        password: tempPassword,
        email_confirm: true,
      })
      if (created.error || !created.data.user) throw created.error || new Error('No se pudo crear el usuario')
      const newUser = created.data.user

      // Actualizar perfil con metadatos
      const { error: upErr } = await admin.from('profiles').update({
        name,
        discord_id,
        character_limit,
        is_admin,
      }).eq('id', newUser.id)
      if (upErr) throw upErr

      // Evitar NEXT_REDIRECT en el cliente: solo revalidamos y no redirigimos
      revalidatePath('/admin/users')
      // No devolver objeto para cumplir tipo de Server Action
    } catch (e: unknown) {
      console.error('createUser error', e)
    }
  }

  async function updateUser(formData: FormData) {
    'use server'
    const supa = createClient()
    const { data: { user: u } } = await supa.auth.getUser()
    if (!u) redirect('/login')
    const { data: me2 } = await supa.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
    if (!me2?.is_admin) redirect('/dashboard')

    const id = String(formData.get('id') || '')
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const name = String(formData.get('name') || '').trim()
    const discord_id = String(formData.get('discord_id') || '').trim()
    const character_limit = Number(formData.get('character_limit') || 4)
  const is_admin = formData.get('is_admin') === 'on'
  const new_password = String(formData.get('new_password') || '')
    if (!id) throw new Error('ID requerido')

    const admin2 = createAdminClient()
    // Si hay email, actualizarlo en Auth (sin verificación)
    if (email) {
      const upd = await admin2.auth.admin.updateUserById(id, { email, email_confirm: true })
      if (upd.error) throw upd.error
    }
    // Si hay nueva contraseña, actualizarla en Auth
    if (new_password) {
      const updPwd = await admin2.auth.admin.updateUserById(id, { password: new_password })
      if (updPwd.error) throw updPwd.error
    }

    const { error } = await admin2.from('profiles').update({
      name, discord_id, character_limit, is_admin
    }).eq('id', id)
  if (error) throw error

    revalidatePath('/admin/users')
  }

  async function deleteUser(formData: FormData) {
    'use server'
    const supa = createClient()
    const { data: { user: u } } = await supa.auth.getUser()
    if (!u) redirect('/login')
    const { data: me2 } = await supa.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
    if (!me2?.is_admin) redirect('/dashboard')

    const id = String(formData.get('id') || '')
    if (!id) throw new Error('ID requerido')
    if (id === u.id) {
      // Evitar auto-borrado accidental desde el panel
      throw new Error('No podés eliminar tu propio usuario desde aquí.')
    }

    const admin2 = createAdminClient()
    // Esta llamada elimina auth.users y gracias a ON DELETE CASCADE
    // se eliminan profiles, characters y pagos_log relacionados
    const del = await admin2.auth.admin.deleteUser(id)
    if (del.error) throw del.error

    revalidatePath('/admin/users')
  }

  // Los banners ahora dependen de query solo si llegan (pero preferimos inline con server action más adelante)
  const status = typeof searchParams?.status === 'string' ? searchParams!.status : undefined
  const errorMsg = typeof searchParams?.error === 'string' ? searchParams!.error : undefined
  const createdEmail = typeof searchParams?.email === 'string' ? searchParams!.email : undefined
  const tempPass = typeof searchParams?.temp === 'string' ? searchParams!.temp : undefined

  return (
    <div className="space-y-4">
      <Title>Usuarios</Title>

      {!!status && (
  <div className="text-sm rounded border border-stone-700 p-2">
          {status === 'created' && (
            <div>
              Usuario creado sin verificación de correo.
              {createdEmail && (
                <>
                  {' '}Credenciales iniciales: <b>{createdEmail}</b>{tempPass ? <> / <b>{tempPass}</b></> : null}. Compártelas y pide que cambie la contraseña.
                </>
              )}
            </div>
          )}
          {status === 'updated' && 'Perfil actualizado.'}
        </div>
      )}
      {!!errorMsg && (
        <div className="text-sm rounded border border-red-700 p-2 text-red-300">
          Error: {decodeURIComponent(errorMsg)}
        </div>
      )}

  <section className="tavern-panel p-4">
        <h2 className="font-semibold mb-2">Crear nuevo usuario</h2>
        <form action={createUser} className="grid md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Email</span>
            <input name="email" type="email" className="bg-transparent border border-stone-700 rounded px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Nombre</span>
            <input name="name" type="text" required className="bg-transparent border border-stone-700 rounded px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Discord ID</span>
            <input name="discord_id" type="text" className="bg-transparent border border-stone-700 rounded px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Límite de personajes</span>
            <input name="character_limit" type="number" min={0} defaultValue={4} required className="bg-transparent border border-stone-700 rounded px-2 py-1" />
          </label>
          <label className="mt-1 flex items-center gap-2">
            <input name="is_admin" type="checkbox" className="accent-stone-200" />
            <span className="text-sm">Es administrador</span>
          </label>
          <div className="md:col-span-2">
            <button className="border border-stone-700 rounded px-3 py-1">Crear usuario</button>
          </div>
        </form>
        <p className="text-xs opacity-70 mt-2">Nombre y Límite son obligatorios. Email y Discord ID son opcionales. Si no indicas email, se generará un email sintético y una contraseña temporal para poder iniciar sesión y luego podrás editar su perfil aquí.</p>
      </section>
      <div className="tavern-panel p-3">
      <table className="w-full text-sm">
        <thead className="text-left opacity-70"><tr>
          <th>Email</th><th>Nombre</th><th>Discord</th><th>Límite</th><th>Admin</th><th>Creado</th>
        </tr></thead>
        <tbody>
          {(users as ProfileRow[] | null ?? []).map((u) => (
            <tr key={u.id} className="border-t border-stone-800/70 align-top">
              <td colSpan={5}>
                <form action={updateUser} className="grid md:grid-cols-6 gap-3 py-2">
                  <input type="hidden" name="id" value={u.id} />
                  <label className="flex flex-col gap-1">
                    <span className="text-xs opacity-70">Email</span>
                    <input name="email" defaultValue={emailById.get(u.id) ?? ''} className="bg-transparent border border-stone-700 rounded px-2 py-1" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs opacity-70">Nombre</span>
                    <input name="name" defaultValue={u.name ?? ''} className="bg-transparent border border-stone-700 rounded px-2 py-1" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs opacity-70">Discord ID</span>
                    <input name="discord_id" defaultValue={u.discord_id ?? ''} className="bg-transparent border border-stone-700 rounded px-2 py-1" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs opacity-70">Límite</span>
                    <input name="character_limit" type="number" min={0} defaultValue={u.character_limit} className="bg-transparent border border-stone-700 rounded px-2 py-1" />
                  </label>
                  <label className="flex items-center gap-2 mt-6">
                    <input name="is_admin" type="checkbox" defaultChecked={u.is_admin} className="accent-stone-200" />
                    <span className="text-xs">Admin</span>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs opacity-70">Nueva contraseña</span>
                    <input name="new_password" type="password" placeholder="(opcional)" className="bg-transparent border border-stone-700 rounded px-2 py-1" />
                  </label>
                  <div className="flex items-end gap-2">
                    <button className="border border-stone-700 rounded px-3 py-1">Guardar</button>
                  </div>
                </form>
                <form action={deleteUser} className="py-1">
                  <input type="hidden" name="id" value={u.id} />
                  <ConfirmButton
                    type="submit"
                    className="border border-red-700 text-red-300 rounded px-3 py-1"
                    title="Eliminar usuario"
                    message={`¿Eliminar definitivamente al usuario "${u.name ?? emailById.get(u.id) ?? u.id}" y todos sus personajes?`}
                  >
                    Eliminar
                  </ConfirmButton>
                </form>
                <div className="text-xs opacity-60">Creado: {new Date(u.created_at).toLocaleString('es-AR')}</div>
              </td>
            </tr>
          ))}
        </tbody>
  </table>
  </div>
      <p className="opacity-70">Podés actualizar email, nombre, Discord, límite y rol.</p>
    </div>
  )
}
