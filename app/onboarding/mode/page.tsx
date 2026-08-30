import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ModeSelector from '@/components/ModeSelector'

export default async function ChangeModePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: venue } = await supabase
    .from('venues').select('*').eq('owner_id', user.id).maybeSingle()

  if (!venue) redirect('/onboarding')

  return (
    <ModeSelector
      venueId={venue.id}
      currentMode={venue.mode}
      hasQrCode={!!venue.singers_qr_code}
    />
  )
}
