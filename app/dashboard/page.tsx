import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Title from '@/components/Title'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  type MyChar = { id: string; name: string; exp: number; level: number; items: string; partidas: string; event_points: number }
  const { data: characters } = await supabase
    .from('characters')
    .select('id, name, exp, level, items, partidas, event_points')
    .eq('owner', user.id)
    .order('name')

  // Pagos semanales para mis personajes
  const ids = (characters as MyChar[] | null ?? []).map(c => c.id)
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

  return (
    <div className="space-y-6">
      <Title>Mis personajes</Title>
      <ul className="grid md:grid-cols-2 gap-4">
        {(characters as MyChar[] | null ?? []).map((c) => {
          const pagos = pagosMap.get(c.id) ?? 0
          const boxes = Array.from({ length: 5 }, (_, i) => i < pagos)
          return (
              <li key={c.id} className="sheet-card p-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <div className="font-semibold text-lg">{c.name}</div>
                  <div className="text-sm opacity-80">Nivel {c.level} · EXP {c.exp}/74</div>
                </div>
                <div className="sheet-section p-3 flex items-center gap-3">
                  <span className="text-xs opacity-70">Pagos semana:</span>
                  <div className="flex gap-1">
                    {boxes.map((filled, i) => (
                      <div key={i} className={`w-4 h-4 rounded border ${filled ? 'bg-green-600 border-green-600' : 'border-stone-600'}`} />
                    ))}
                  </div>
                </div>
                <div className="sheet-section p-3 flex items-center gap-3">
                  <span className="text-xs opacity-70">Puntos de evento:</span>
                  <div className="text-sm font-semibold">{c.event_points}</div>
                </div>
                <div className="sheet-section p-3">
                  <div className="text-sm opacity-80 mb-1">Objetos</div>
                  <pre className="whitespace-pre-wrap text-sm opacity-90">{c.items || '—'}</pre>
                </div>
                <div className="sheet-section p-3">
                  <div className="text-sm opacity-80 mb-1">Partidas</div>
                  <pre className="whitespace-pre-wrap text-sm opacity-90">{c.partidas || '—'}</pre>
                </div>
              </li>
          )
        })}
        {(!characters || characters.length === 0) && (
          <li className="opacity-70">Aún no tenés personajes asignados.</li>
        )}
      </ul>
      <div>
        <Link className="underline" href="/">Volver al inicio</Link>
      </div>
    </div>
  )
}
