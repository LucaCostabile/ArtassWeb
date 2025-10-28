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

export default async function AdminCharacterDetail({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!me?.is_admin) redirect('/dashboard')

  const { data: character } = await supabase.from('characters').select('id, name, exp, level, items, owner').eq('id', params.id).maybeSingle()
  if (!character) redirect('/admin/characters')

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

  return (
    <div className="space-y-6">
      <div>
        <Title>{character.name}</Title>
        <div className="opacity-80 text-sm">Nivel {character.level} · EXP {character.exp}/74</div>
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

      <div className="space-y-1">
        <div className="font-semibold">Objetos</div>
        <pre className="whitespace-pre-wrap rounded border border-stone-800/70 bg-stone-900/40 p-3 text-sm opacity-90">{character.items || '—'}</pre>
      </div>
    </div>
  )
}
