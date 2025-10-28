import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Title from '@/components/Title'

function PagoBoxes({ count }: { count: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={`h-6 w-6 rounded ${i < count ? 'bg-green-500' : 'bg-slate-800'} border border-slate-600`}
          title={`${i + 1} / 5`}
        />
      ))}
    </div>
  )
}

type CharacterRow = { id: string; name: string; exp: number; level: number; items: string; partidas: string; owner: string; event_points: number }

export default async function AdminCharacterDetail({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!me?.is_admin) redirect('/dashboard')

  const { data: character } = await supabase
    .from('characters')
    .select('id, name, exp, level, items, partidas, owner, event_points')
    .eq('id', params.id)
    .maybeSingle()
  if (!character) redirect('/admin/characters')
  const characterRow = character as CharacterRow

  const { data: weekly } = await supabase
    .from('character_pagos_weekly')
    .select('pagos_weekly')
    .eq('character_id', params.id)
    .maybeSingle()

  const pagosCount = (weekly?.pagos_weekly ?? 0) as number

  async function increment() {
    'use server'
    const supa = createClient()
    const { data: { user: u } } = await supa.auth.getUser()
    if (!u) redirect('/login')
    const { data: me2 } = await supa.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
    if (!me2?.is_admin) redirect('/dashboard')

    const { error } = await supa.rpc('increment_pago', { p_character_id: params.id })
    if (error) throw error

    revalidatePath(`/admin/characters/${params.id}`)
  }

  async function incEP() {
    'use server'
    const supa = createClient()
    const { data: { user: u } } = await supa.auth.getUser()
    if (!u) redirect('/login')
    const { data: me2 } = await supa.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
    if (!me2?.is_admin) redirect('/dashboard')
    const { data: row, error: selErr } = await supa.from('characters').select('event_points').eq('id', params.id).maybeSingle()
    if (selErr) throw selErr
    const next = Number(row?.event_points ?? 0) + 1
    const { error: updErr } = await supa.from('characters').update({ event_points: next }).eq('id', params.id)
    if (updErr) throw updErr
    revalidatePath(`/admin/characters/${params.id}`)
  }

  async function decEP() {
    'use server'
    const supa = createClient()
    const { data: { user: u } } = await supa.auth.getUser()
    if (!u) redirect('/login')
    const { data: me2 } = await supa.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
    if (!me2?.is_admin) redirect('/dashboard')
    const { data: row, error: selErr } = await supa.from('characters').select('event_points').eq('id', params.id).maybeSingle()
    if (selErr) throw selErr
    const next = Math.max(0, Number(row?.event_points ?? 0) - 1)
    const { error: updErr } = await supa.from('characters').update({ event_points: next }).eq('id', params.id)
    if (updErr) throw updErr
    revalidatePath(`/admin/characters/${params.id}`)
  }

  return (
    <div className="space-y-6">
      <div>
  <Title>{characterRow.name}</Title>
  <div className="opacity-80 text-sm">Nivel {characterRow.level} · EXP {characterRow.exp}/74</div>
      </div>

      <div className="space-y-2">
        <div className="font-semibold">Pagos semanales</div>
        <PagoBoxes count={pagosCount} />
        <form action={increment}>
          <button
            className="mt-2 rounded border border-stone-700 px-3 py-1 disabled:opacity-50"
            disabled={pagosCount >= 5}
          >
            Marcar pago (+1)
          </button>
        </form>
        {pagosCount >= 5 && (
          <div className="text-sm opacity-70">Límite semanal alcanzado (5). Reinicia el sábado 00:00.</div>
        )}
      </div>

      <div className="space-y-2">
        <div className="font-semibold">Puntos de evento</div>
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">{characterRow.event_points ?? 0}</div>
          <form action={decEP}><button className="rounded border border-stone-700 px-3 py-1">−</button></form>
          <form action={incEP}><button className="rounded border border-stone-700 px-3 py-1">+</button></form>
        </div>
      </div>

      <div className="space-y-1">
        <div className="font-semibold">Objetos</div>
  <pre className="whitespace-pre-wrap rounded border border-stone-800/70 bg-stone-900/40 p-3 text-sm opacity-90">{characterRow.items || '—'}</pre>
      </div>

      <div className="space-y-1">
        <div className="font-semibold">Partidas</div>
        <pre className="whitespace-pre-wrap rounded border border-stone-800/70 bg-stone-900/40 p-3 text-sm opacity-90">{characterRow.partidas || '—'}</pre>
      </div>
    </div>
  )
}
