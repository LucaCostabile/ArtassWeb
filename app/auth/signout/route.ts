import { createActionClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createActionClient()
  await supabase.auth.signOut()
  // Redirigir a la misma origin del request
  return NextResponse.redirect(new URL('/', req.url))
}
