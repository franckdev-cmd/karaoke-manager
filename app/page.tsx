import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: venue } = await supabase.from('venues').select('*').eq('owner_id', user.id).maybeSingle()

  if (!venue || !venue.onboarding_done) redirect('/onboarding')

  redirect('/manager')
}
