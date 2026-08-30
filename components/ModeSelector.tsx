'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { VenueMode } from '@/lib/supabase/types'
import Logo from './Logo'

function genCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Icône signature "Chanteurs" : un QR unique qui irradie vers plusieurs micros
function SingersIcon({ active }: { active: boolean }) {
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      {[0, 1, 2].map(i => {
        const angle = -50 + i * 50
        const rad = (angle * Math.PI) / 180
        const x2 = 44 + Math.cos(rad) * 32
        const y2 = 44 + Math.sin(rad) * 32
        return (
          <g key={i}>
            <line x1="44" y1="44" x2={x2} y2={y2} stroke={active ? 'url(#sg)' : '#d9cdf5'}
              strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" />
            <circle cx={x2} cy={y2} r="7" fill={active ? 'url(#sg)' : '#ece4fb'} />
          </g>
        )
      })}
      <rect x="30" y="30" width="28" height="28" rx="6" fill={active ? 'url(#sg)' : '#c9b8ee'} />
      <rect x="36" y="36" width="6" height="6" fill="#fff" />
      <rect x="46" y="36" width="6" height="6" fill="#fff" opacity="0.6" />
      <rect x="36" y="46" width="6" height="6" fill="#fff" opacity="0.6" />
      <rect x="46" y="46" width="6" height="6" fill="#fff" />
    </svg>
  )
}

// Icône signature "Tables" : un plan de salle avec tables rondes groupées
function TablesIcon({ active }: { active: boolean }) {
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="68" height="68" rx="14"
        stroke={active ? 'url(#tg)' : '#d9cdf5'} strokeWidth="2.5" strokeDasharray="5 5" fill="none" />
      {[[28, 28], [60, 28], [28, 60], [60, 60]].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="11" fill={active ? 'url(#tg)' : '#ece4fb'} />
          <circle cx={cx} cy={cy} r="4" fill="#fff" opacity="0.85" />
        </g>
      ))}
    </svg>
  )
}

export default function ModeSelector({
  venueId, currentMode = null, hasQrCode = false, logoUrl = null, logoScale = 1
}: { venueId: string; currentMode?: VenueMode | null; hasQrCode?: boolean; logoUrl?: string | null; logoScale?: number }) {
  const router = useRouter()
  const [hovered, setHovered] = useState<VenueMode | null>(null)
  const [loading, setLoading] = useState<VenueMode | null>(null)

  const choose = async (mode: VenueMode) => {
    setLoading(mode)
    const supabase = createClient()

    // On ne touche à la base que si quelque chose doit vraiment changer, pour ne
    // jamais écraser un état existant (salles/tables déjà créées, QR déjà généré...).
    if (mode !== currentMode || (mode === 'singers' && !hasQrCode)) {
      const patch: Record<string, unknown> = { mode }
      if (mode === 'singers' && !hasQrCode) patch.singers_qr_code = genCode()
      await supabase.from('venues').update(patch).eq('id', venueId)
    }

    router.push(mode === 'singers' ? '/onboarding/singers' : '/onboarding/tables')
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const cardStyle = (mode: VenueMode): React.CSSProperties => ({
    flex: 1, minWidth: 240, background: '#fff', borderRadius: 20,
    border: `2px solid ${hovered === mode ? 'transparent' : 'var(--surface-border)'}`,
    backgroundImage: hovered === mode ? 'linear-gradient(#fff,#fff), var(--accent-gradient)' : undefined,
    backgroundOrigin: 'border-box', backgroundClip: hovered === mode ? 'padding-box, border-box' : undefined,
    padding: '36px 28px', textAlign: 'center', cursor: loading ? 'default' : 'pointer',
    boxShadow: hovered === mode ? 'var(--shadow-hover)' : 'var(--shadow-card)',
    transform: hovered === mode ? 'translateY(-4px)' : 'none',
    transition: 'all .18s ease', opacity: loading && loading !== mode ? 0.5 : 1
  })

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: 'radial-gradient(circle at 80% 10%, #fdf0f8 0%, #ffffff 55%)',
      padding: '40px 20px'
    }}>
      <div style={{
        position: 'fixed', top: 'max(20px, env(safe-area-inset-top))', right: 'max(20px, env(safe-area-inset-right))',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, zIndex: 10, maxWidth: 'calc(100vw - 40px)'
      }}>
        <button onClick={() => router.push('/settings')} style={navBtnStyle}>⚙ Paramètres</button>
        <button onClick={handleLogout} style={navBtnStyle}>Déconnexion ⏻</button>
      </div>

      <div className="anim-fade-slide-down" style={{ textAlign: 'center', marginBottom: 40, maxWidth: 520 }}>
        <div style={{ marginBottom: 22 }}>
          <Logo size="md" customSrc={logoUrl} scale={logoScale} />
        </div>
        <div style={{
          display: 'inline-block', fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
          color: 'var(--accent)', background: 'var(--accent-soft)', padding: '5px 14px',
          borderRadius: 999, marginBottom: 16, textTransform: 'uppercase'
        }}>
          Configuration initiale
        </div>
        <h1 className="display" style={{ fontSize: 30, margin: '0 0 10px' }}>
          Comment veux-tu organiser ton karaoké ?
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: 15, margin: 0 }}>
          Ce choix définit comment tes clients accèdent à la file d'attente. Tu pourras en discuter avec nous si tu changes d'avis.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 640, width: '100%' }}>
        <div className="anim-slide-in-left" style={{ animationDelay: '2.3s', flex: 1, minWidth: 240 }}>
          <div
            style={cardStyle('singers')}
            onMouseEnter={() => setHovered('singers')}
            onMouseLeave={() => setHovered(h => h === 'singers' ? null : h)}
            onClick={() => !loading && choose('singers')}
          >
          <SingersIcon active={hovered === 'singers'} />
          <h2 className="display" style={{ fontSize: 19, margin: '18px 0 8px' }}>
            Par chanteurs
            {currentMode === 'singers' && <span style={{
              marginLeft: 8, fontSize: 10, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-soft)',
              borderRadius: 999, padding: '3px 9px', verticalAlign: 'middle'
            }}>ACTUEL</span>}
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5, margin: 0 }}>
            Un seul QR code pour toute la salle. Chaque chanteur s'inscrit directement, sans notion de table.
          </p>
          <div style={{
            marginTop: 18, fontSize: 13, fontWeight: 700, color: 'var(--accent)',
            opacity: loading === 'singers' ? 1 : 0, transition: 'opacity .15s'
          }}>
            {loading === 'singers' ? 'Génération du QR code...' : ''}
          </div>
          </div>
        </div>

        <div className="anim-slide-in-left" style={{ animationDelay: '.3s', flex: 1, minWidth: 240 }}>
          <div
            style={cardStyle('tables')}
            onMouseEnter={() => setHovered('tables')}
            onMouseLeave={() => setHovered(h => h === 'tables' ? null : h)}
            onClick={() => !loading && choose('tables')}
          >
          <TablesIcon active={hovered === 'tables'} />
          <h2 className="display" style={{ fontSize: 19, margin: '18px 0 8px' }}>
            Par tables
            {currentMode === 'tables' && <span style={{
              marginLeft: 8, fontSize: 10, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-soft)',
              borderRadius: 999, padding: '3px 9px', verticalAlign: 'middle'
            }}>ACTUEL</span>}
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5, margin: 0 }}>
            Crée des salles, puis des tables dans chaque salle. Chaque table a son propre code d'accès.
          </p>
          <div style={{
            marginTop: 18, fontSize: 13, fontWeight: 700, color: 'var(--accent)',
            opacity: loading === 'tables' ? 1 : 0, transition: 'opacity .15s'
          }}>
            {loading === 'tables' ? 'Préparation...' : ''}
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999,
  border: '1px solid var(--surface-border)', background: '#fff', fontSize: 12.5, fontWeight: 600,
  color: 'var(--ink-soft)', cursor: 'pointer'
}
