import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FloorPlanBuilder from '@/components/FloorPlanBuilder'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function TablesOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: venue } = await supabase
    .from('venues').select('*').eq('owner_id', user.id).maybeSingle()

  if (!venue || venue.mode !== 'tables') redirect('/onboarding')

  const { data: rooms } = await supabase
    .from('rooms').select('*').eq('venue_id', venue.id).order('sort_order').order('created_at')

  const { data: tables } = await supabase
    .from('venue_tables').select('*').eq('venue_id', venue.id).order('sort_order').order('created_at')

  return <FloorPlanBuilder venueId={venue.id} logoUrl={venue.logo_url} logoScale={venue.logo_scale} initialRooms={rooms ?? []} initialTables={tables ?? []} />
}
