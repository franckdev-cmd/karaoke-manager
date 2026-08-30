import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ModeSelector from '@/components/ModeSelector'

// Empêche Next.js de réafficher une version en cache de cet écran quand on
// navigue en arrière (bouton retour du navigateur) — on veut toujours l'état
// réel du venue en base, pas un instantané figé.
export const dynamic = 'force-dynamic'
export const revalidate = 0

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
      logoUrl={venue.logo_url}
    />
  )
}
