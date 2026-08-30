import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ManagerTables from '@/components/ManagerTables'

export default async function ManagerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: venue } = await supabase.from('venues').select('*').eq('owner_id', user.id).maybeSingle()
  if (!venue || !venue.onboarding_done) redirect('/onboarding')

  if (venue.mode === 'singers') {
    return (
      <div style={{ padding: 40, fontFamily: 'DM Sans, sans-serif' }}>
        <h1 className="display">Manager — {venue.name}</h1>
        <p style={{ color: 'var(--ink-soft)' }}>
          Mode chanteurs : l'interface de gestion de la file d'attente unique arrive dans une
          prochaine étape.
        </p>
      </div>
    )
  }

  const { data: rooms } = await supabase
    .from('rooms').select('*').eq('venue_id', venue.id).order('sort_order').order('created_at')

  const { data: tables } = await supabase
    .from('venue_tables').select('*').eq('venue_id', venue.id).order('sort_order').order('created_at')

  const { data: queue } = await supabase
    .from('queue_items').select('*').eq('venue_id', venue.id).eq('done', false).order('registered_at')

  const { data: rotationRow } = await supabase
    .from('rotation_state').select('*').eq('venue_id', venue.id).maybeSingle()

  return (
    <ManagerTables
      venueId={venue.id}
      venueName={venue.name}
      initialRooms={rooms ?? []}
      initialTables={tables ?? []}
      initialQueue={queue ?? []}
      initialRotation={rotationRow}
    />
  )
}
