import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createActionClient } from '@/lib/supabase/server'

function isEmailLike(s: string) {
  return /.+@.+\..+/.test(s)
}

export async function POST(req: Request) {
  const form = await req.formData()
  const identifier = String(form.get('identifier') || '').trim()
  const password = String(form.get('password') || '')
  if (!identifier || !password) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  let email = identifier
  try {
    if (!isEmailLike(identifier)) {
      const admin = createAdminClient()
      // Buscar por nombre o discord_id en perfiles
      const { data: prof, error: pErr } = await admin
        .from('profiles')
        .select('id')
        .or(`name.eq.${identifier},discord_id.eq.${identifier}`)
        .limit(1)
        .maybeSingle()
      if (pErr) throw pErr
      if (!prof?.id) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

      const got = await admin.auth.admin.getUserById(prof.id)
      if (got.error || !got.data.user?.email) {
        return NextResponse.json({ error: 'No se encontró email para el usuario' }, { status: 404 })
      }
      email = got.data.user.email
    }

  const supa = createActionClient()
    const { error } = await supa.auth.signInWithPassword({ email, password })
    if (error) return NextResponse.json({ error: error.message }, { status: 401 })

    // Redirigir a la misma origin del request (funciona en Vercel, Preview y Prod)
    return NextResponse.redirect(new URL('/', req.url))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
