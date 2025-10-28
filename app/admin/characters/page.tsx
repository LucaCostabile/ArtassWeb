import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import ConfirmButton from '@/components/ConfirmButton'
import Title from '@/components/Title'

export default async function AdminCharacters({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!me?.is_admin) redirect('/dashboard')

  // Tipos
  type CharItem = { id: string; name: string; exp: number; level: number; owner: string; items: string; event_points: number }
  type ProfileItem = { id: string; name: string | null }

  // Filtros desde query
  const fOwner = typeof searchParams?.owner === 'string' ? searchParams!.owner.trim() : ''
  const fName = typeof searchParams?.name === 'string' ? searchParams!.name.trim() : ''
  const fLevel = typeof searchParams?.level === 'string' && searchParams!.level.trim() !== '' ? Number(searchParams!.level) : undefined

  // Obtener lista de usuarios para filtros y selects
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, name')
    .order('name', { ascending: true })

  // Construir query de personajes con filtros
  let query = supabase
    .from('characters')
    .select('id, name, exp, level, owner, items, event_points')
    .order('created_at', { ascending: false })
  if (fOwner) query = query.eq('owner', fOwner)
  if (fName) query = query.ilike('name', `%${fName}%`)
  if (typeof fLevel === 'number' && !Number.isNaN(fLevel)) query = query.eq('level', fLevel)
  const { data: chars } = await query

  // Pagos semanales: obtener conteo por personaje usando la vista
  const ids = (chars as CharItem[] | null ?? []).map(c => c.id)
  type PagoRow = { character_id: string; pagos_weekly: number }
  const pagosMap = new Map<string, number>()
  if (ids.length > 0) {
    const { data: pagosRows } = await supabase
      .from('character_pagos_weekly')
      .select('character_id, pagos_weekly')
      .in('character_id', ids)
    if (pagosRows) {
      for (const r of pagosRows as PagoRow[]) pagosMap.set(r.character_id, Number(r.pagos_weekly) || 0)
    }
  }

  async function createCharacter(formData: FormData) {
    'use server'
    const supa = createClient()
    const { data: { user: u } } = await supa.auth.getUser()
    if (!u) redirect('/login')
    const { data: me2 } = await supa.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
    if (!me2?.is_admin) redirect('/dashboard')

    const owner = String(formData.get('owner') || '').trim()
    const name = String(formData.get('name') || '').trim()
    const exp = Number(formData.get('exp') || 0)
    const level = Number(formData.get('level') || 1)
    const items = String(formData.get('items') || '')

    if (!owner || !name) throw new Error('Owner y Nombre son obligatorios')
    if (Number.isNaN(exp) || exp < 0 || exp > 74) throw new Error('EXP debe estar entre 0 y 74')
    if (Number.isNaN(level) || level < 1) throw new Error('Nivel debe ser >= 1')

    const admin = createAdminClient()
    const { error } = await admin.from('characters').insert({ owner, name, exp, level, items })
    if (error) throw error
    revalidatePath('/admin/characters')
  }

  async function updateCharacter(formData: FormData) {
    'use server'
    const supa = createClient()
    const { data: { user: u } } = await supa.auth.getUser()
    if (!u) redirect('/login')
    const { data: me2 } = await supa.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
    if (!me2?.is_admin) redirect('/dashboard')

    const id = String(formData.get('id') || '').trim()
    const owner = String(formData.get('owner') || '').trim()
    const name = String(formData.get('name') || '').trim()
    const exp = Number(formData.get('exp') || 0)
    const level = Number(formData.get('level') || 1)
    const items = String(formData.get('items') || '')

    if (!id) throw new Error('ID requerido')
    if (!owner || !name) throw new Error('Owner y Nombre son obligatorios')
    if (Number.isNaN(exp) || exp < 0 || exp > 74) throw new Error('EXP debe estar entre 0 y 74')
    if (Number.isNaN(level) || level < 1) throw new Error('Nivel debe ser >= 1')

    const admin = createAdminClient()
    const { error } = await admin.from('characters').update({ owner, name, exp, level, items }).eq('id', id)
    if (error) throw error
    revalidatePath('/admin/characters')
  }

  async function incrementPayment(formData: FormData) {
    'use server'
    const supa = createClient()
    const { data: { user: u } } = await supa.auth.getUser()
    if (!u) redirect('/login')
    const { data: me2 } = await supa.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
    if (!me2?.is_admin) redirect('/dashboard')
    const id = String(formData.get('id') || '').trim()
    if (!id) throw new Error('ID requerido')
    // Invocar RPC con el token del usuario actual (admin) para que auth.uid() esté disponible en la función
    const { error } = await supa.rpc('increment_pago', { p_character_id: id })
    if (error) {
      // Fallback si la función no existe aún en DB
      const errCode = (error as { code?: string } | null)?.code
      if (errCode === 'PGRST202') {
        // Implementar lógica equivalente desde la app
        const now = new Date()
        const weekWindow = (d: Date) => {
          const base = new Date(d)
          const day = base.getDay() // 0=Dom..6=Sab
          base.setHours(0,0,0,0)
          const diffToMonday = (day + 6) % 7
          base.setDate(base.getDate() - diffToMonday) // Lunes 00:00
          const satStart = new Date(base)
          satStart.setDate(satStart.getDate() + 5) // Sábado 00:00
          if (d < satStart) satStart.setDate(satStart.getDate() - 7)
          const end = new Date(satStart)
          end.setDate(end.getDate() + 7)
          return { start: satStart, end }
        }
        const { start, end } = weekWindow(now)
        const admin = createAdminClient()
        const { count, error: cntErr } = await admin
          .from('pagos_log')
          .select('id', { count: 'exact', head: false })
          .eq('character_id', id)
          .gte('created_at', start.toISOString())
          .lt('created_at', end.toISOString())
        if (cntErr) throw cntErr
        if ((count ?? 0) >= 5) throw new Error('Límite semanal de pagos alcanzado (5).')
        const { error: insErr } = await admin.from('pagos_log').insert({ character_id: id })
        if (insErr) throw insErr
      } else {
        throw error
      }
    }
    revalidatePath('/admin/characters')
  }

  async function decrementPayment(formData: FormData) {
    'use server'
    const supa = createClient()
    const { data: { user: u } } = await supa.auth.getUser()
    if (!u) redirect('/login')
    const { data: me2 } = await supa.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
    if (!me2?.is_admin) redirect('/dashboard')
    const id = String(formData.get('id') || '').trim()
    if (!id) throw new Error('ID requerido')
    // Invocar RPC con el token del usuario actual (admin) para que auth.uid() esté disponible en la función
    const { error } = await supa.rpc('decrement_pago', { p_character_id: id })
    if (error) {
      // Fallback si la función no existe aún en DB
      const errCode = (error as { code?: string } | null)?.code
      if (errCode === 'PGRST202') {
        const now = new Date()
        const weekWindow = (d: Date) => {
          const base = new Date(d)
          const day = base.getDay()
          base.setHours(0,0,0,0)
          const diffToMonday = (day + 6) % 7
          base.setDate(base.getDate() - diffToMonday)
          const satStart = new Date(base)
          satStart.setDate(satStart.getDate() + 5)
          if (d < satStart) satStart.setDate(satStart.getDate() - 7)
          const end = new Date(satStart)
          end.setDate(end.getDate() + 7)
          return { start: satStart, end }
        }
        const { start, end } = weekWindow(now)
        const admin = createAdminClient()
        const { data: rows, error: selErr } = await admin
          .from('pagos_log')
          .select('id, created_at')
          .eq('character_id', id)
          .gte('created_at', start.toISOString())
          .lt('created_at', end.toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
        if (selErr) throw selErr
        const toDel = rows && rows.length > 0 ? rows[0].id as string : undefined
        if (toDel) {
          const { error: delErr } = await admin.from('pagos_log').delete().eq('id', toDel)
          if (delErr) throw delErr
        }
      } else {
        throw error
      }
    }
    revalidatePath('/admin/characters')
  }

  async function incrementEventPoints(formData: FormData) {
    'use server'
    const supa = createClient()
    const { data: { user: u } } = await supa.auth.getUser()
    if (!u) redirect('/login')
    const { data: me2 } = await supa.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
    if (!me2?.is_admin) redirect('/dashboard')
    const id = String(formData.get('id') || '').trim()
    if (!id) throw new Error('ID requerido')
    const { data: row, error: selErr } = await supa
      .from('characters')
      .select('event_points')
      .eq('id', id)
      .maybeSingle()
    if (selErr) throw selErr
    const current = Number(row?.event_points ?? 0)
    const next = current + 1
    const { error: updErr } = await supa
      .from('characters')
      .update({ event_points: next })
      .eq('id', id)
    if (updErr) throw updErr
    revalidatePath('/admin/characters')
  }

  async function decrementEventPoints(formData: FormData) {
    'use server'
    const supa = createClient()
    const { data: { user: u } } = await supa.auth.getUser()
    if (!u) redirect('/login')
    const { data: me2 } = await supa.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
    if (!me2?.is_admin) redirect('/dashboard')
    const id = String(formData.get('id') || '').trim()
    if (!id) throw new Error('ID requerido')
    const { data: row, error: selErr } = await supa
      .from('characters')
      .select('event_points')
      .eq('id', id)
      .maybeSingle()
    if (selErr) throw selErr
    const current = Number(row?.event_points ?? 0)
    const next = Math.max(0, current - 1)
    const { error: updErr } = await supa
      .from('characters')
      .update({ event_points: next })
      .eq('id', id)
    if (updErr) throw updErr
    revalidatePath('/admin/characters')
  }


  async function deleteCharacter(formData: FormData) {
    'use server'
    const supa = createClient()
    const { data: { user: u } } = await supa.auth.getUser()
    if (!u) redirect('/login')
    const { data: me2 } = await supa.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
    if (!me2?.is_admin) redirect('/dashboard')

    const id = String(formData.get('id') || '').trim()
    if (!id) throw new Error('ID requerido')

    const admin = createAdminClient()
    const { error } = await admin.from('characters').delete().eq('id', id)
    if (error) throw error
    revalidatePath('/admin/characters')
  }

  return (
    <div className="space-y-4">
      <Title>Personajes</Title>
      {/* Filtros */}
      <form method="get" className="grid md:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm opacity-80">Usuario</span>
          <select name="owner" defaultValue={fOwner} className="bg-transparent border border-stone-700 rounded px-2 py-1">
            <option value="">Todos</option>
            {(profileRows as ProfileItem[] | null ?? []).map(p => (
              <option key={p.id} value={p.id}>{p.name ?? p.id}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm opacity-80">Nombre</span>
          <input name="name" defaultValue={fName} className="bg-transparent border border-stone-700 rounded px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm opacity-80">Nivel</span>
          <input name="level" type="number" min={1} defaultValue={typeof fLevel === 'number' ? fLevel : ''} className="bg-transparent border border-stone-700 rounded px-2 py-1" />
        </label>
        <div className="flex items-end">
          <button className="border border-stone-700 rounded px-3 py-1">Filtrar</button>
        </div>
      </form>

      {/* Crear nuevo personaje */}
      <section className="tavern-panel p-4">
        <h2 className="font-semibold mb-2">Crear personaje</h2>
        <form action={createCharacter} className="grid md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Usuario</span>
            <select name="owner" required className="bg-transparent border border-stone-700 rounded px-2 py-1">
              <option value="">Seleccionar…</option>
              {(profileRows as ProfileItem[] | null ?? []).map(p => (
                <option key={p.id} value={p.id}>{p.name ?? p.id}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Nombre</span>
            <input name="name" required className="bg-transparent border border-stone-700 rounded px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Nivel</span>
            <input name="level" type="number" min={1} defaultValue={1} className="bg-transparent border border-stone-700 rounded px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">EXP (0-74)</span>
            <input name="exp" type="number" min={0} max={74} defaultValue={0} className="bg-transparent border border-stone-700 rounded px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-sm opacity-80">Ítems</span>
            <textarea name="items" placeholder="Listado de ítems" rows={3} className="bg-transparent border border-stone-700 rounded px-2 py-1" />
          </label>
          <div className="md:col-span-3">
            <button className="border border-stone-700 rounded px-3 py-1">Crear</button>
          </div>
        </form>
      </section>

      <ul className="space-y-2">
        {(chars as CharItem[] | null ?? []).map((c) => {
          const pagos = pagosMap.get(c.id) ?? 0
          const boxes = Array.from({ length: 5 }, (_, i) => i < pagos)
          return (
          <li key={c.id} className="sheet-card p-3">
            <form action={updateCharacter} className="grid md:grid-cols-6 gap-3">
              <input type="hidden" name="id" value={c.id} />
              <label className="flex flex-col gap-1">
                <span className="text-xs opacity-70">Usuario</span>
                <select name="owner" defaultValue={c.owner} className="bg-transparent border border-stone-700 rounded px-2 py-1">
                  {(profileRows as ProfileItem[] | null ?? []).map(p => (
                    <option key={p.id} value={p.id}>{p.name ?? p.id}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs opacity-70">Nombre</span>
                <input name="name" defaultValue={c.name} className="bg-transparent border border-stone-700 rounded px-2 py-1" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs opacity-70">Nivel</span>
                <input name="level" type="number" min={1} defaultValue={c.level} className="bg-transparent border border-stone-700 rounded px-2 py-1" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs opacity-70">EXP</span>
                <input name="exp" type="number" min={0} max={74} defaultValue={c.exp} className="bg-transparent border border-stone-700 rounded px-2 py-1" />
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-xs opacity-70">Ítems</span>
                <textarea name="items" defaultValue={c.items} rows={3} className="bg-transparent border border-stone-700 rounded px-2 py-1" />
              </label>
              <div className="md:col-span-6 flex items-center gap-3">
                <button className="border border-stone-700 rounded px-3 py-1">Guardar</button>
              </div>
            </form>
            <div className="flex items-center gap-2 mt-3 justify-end flex-wrap">
              <span className="text-xs opacity-70">Pagos semana:</span>
              <div className="flex gap-1">
                {boxes.map((filled, i) => (
                  <div key={i} className={`w-4 h-4 rounded border ${filled ? 'bg-green-600 border-green-600' : 'border-stone-600'}`} />
                ))}
              </div>
              <form action={decrementPayment}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="border border-stone-700 rounded px-2 py-1 text-sm" title="Reducir pago">−</button>
              </form>
              <form action={incrementPayment}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="border border-stone-700 rounded px-2 py-1 text-sm" title="Agregar pago">+</button>
              </form>
              <div className="mx-3 h-5 w-px bg-stone-700/60" />
              <span className="text-xs opacity-70">Puntos de evento:</span>
              <div className="text-sm font-semibold">{c.event_points}</div>
              <form action={decrementEventPoints}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="border border-stone-700 rounded px-2 py-1 text-sm" title="Restar punto">−</button>
              </form>
              <form action={incrementEventPoints}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="border border-stone-700 rounded px-2 py-1 text-sm" title="Sumar punto">+</button>
              </form>
              <form action={deleteCharacter}>
                <input type="hidden" name="id" value={c.id} />
                <ConfirmButton
                  type="submit"
                  className="border border-red-700 text-red-300 rounded px-2 py-1 text-sm"
                  title="Eliminar personaje"
                  message={`¿Eliminar definitivamente el personaje "${c.name}"?`}
                >
                  Eliminar
                </ConfirmButton>
              </form>
            </div>
          </li>
        )})}
      </ul>
    </div>
  )
}
