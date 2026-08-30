import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FinishSinglersSetup from '@/components/FinishSingersSetup'
import Logo from '@/components/Logo'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SingersOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: venue } = await supabase
    .from('venues').select('*').eq('owner_id', user.id).maybeSingle()

  if (!venue || venue.mode !== 'singers') redirect('/onboarding')

  const registerUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/r/${venue.singers_qr_code}`
  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(registerUrl)}`

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at 80% 10%, #fdf0f8 0%, #ffffff 55%)', padding: 20
    }}>
      <div style={{
        background: '#fff', borderRadius: 24, border: '1px solid var(--surface-border)',
        boxShadow: 'var(--shadow-card)', padding: '40px 36px', textAlign: 'center', maxWidth: 380, width: '100%'
      }}>
        <div style={{ marginBottom: 20 }}>
          <Logo size="sm" customSrc={venue.logo_url} scale={venue.logo_scale} />
        </div>
        <h1 className="display" style={{ fontSize: 22, margin: '0 0 8px' }}>Ton QR code est prêt</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '0 0 24px' }}>
          Affiche-le dans la salle. Tous les chanteurs s'inscrivent depuis ce même code.
        </p>

        <div style={{
          padding: 16, borderRadius: 16, background: 'var(--bg-soft)',
          border: '1px solid var(--surface-border)', display: 'inline-block'
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrImg} alt="QR code chanteurs" width={220} height={220} style={{ display: 'block' }} />
        </div>

        <div className="mono" style={{
          marginTop: 18, fontSize: 13, letterSpacing: 2, color: 'var(--ink-soft)',
          background: 'var(--bg-soft)', borderRadius: 10, padding: '8px 12px'
        }}>
          {venue.singers_qr_code}
        </div>

        <FinishSinglersSetup venueId={venue.id} />
      </div>
    </div>
  )
}
