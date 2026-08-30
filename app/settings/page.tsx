import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsForm from '@/components/SettingsForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: venue } = await supabase
    .from('venues').select('*').eq('owner_id', user.id).maybeSingle()

  if (!venue) redirect('/onboarding')

  return (
    <SettingsForm
      venueId={venue.id}
      initialName={venue.name}
      initialLogoUrl={venue.logo_url}
      userEmail={user.email ?? ''}
    />
  )
}
