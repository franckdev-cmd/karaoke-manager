import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ModeSelector from '@/components/ModeSelector'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: venue } = await supabase
    .from('venues')
    .select('*')
    .eq('owner_id', user!.id)
    .maybeSingle()

  if (!venue) {
    const { data: created } = await supabase
      .from('venues')
      .insert({ owner_id: user!.id, name: user!.email?.split('@')[0] ?? 'Mon établissement' })
      .select('*')
      .single()
    venue = created
  }

  if (venue?.mode === 'tables') redirect('/onboarding/tables')
  if (venue?.mode === 'singers') redirect('/onboarding/singers')

  return <ModeSelector venueId={venue!.id} logoUrl={venue!.logo_url} />
}
