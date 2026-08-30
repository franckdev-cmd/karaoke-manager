'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from './Logo'

type Props = {
  venueId: string
  initialName: string
  initialLogoUrl: string | null
  initialLogoScale: number
  userEmail: string
}

export default function SettingsForm({ venueId, initialName, initialLogoUrl, initialLogoScale, userEmail }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(initialName)
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [logoScale, setLogoScale] = useState(initialLogoScale)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Choisis un fichier image.'); return }
    if (file.size > 2 * 1024 * 1024) { setError('Image trop lourde (max 2 Mo).'); return }
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setLogoUrl(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const save = async () => {
    setBusy(true); setError(''); setSaved(false)
    const { error: err } = await supabase.from('venues')
      .update({ name: name.trim() || initialName, logo_url: logoUrl, logo_scale: logoScale })
      .eq('id', venueId)
    if (err) { setError(err.message); setBusy(false); return }
    setBusy(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-soft)', padding: '32px 20px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <button onClick={() => router.push('/manager')} style={navBtnStyle}>← Manager</button>
          <button onClick={handleLogout} style={navBtnStyle}>Déconnexion ⏻</button>
        </div>

        <div style={{ marginBottom: 22 }}>
          <Logo size="sm" align="left" customSrc={logoUrl} scale={logoScale} />
        </div>

        <h1 className="display" style={{ fontSize: 24, margin: '0 0 4px' }}>Profil & Paramètres</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 24px' }}>{userEmail}</p>

        {error && (
          <div style={{
            background: '#fee2e2', color: 'var(--danger)', fontSize: 12.5, fontWeight: 600,
            padding: '10px 14px', borderRadius: 10, marginBottom: 16
          }}>
            {error}
          </div>
        )}

        <div style={{
          background: '#fff', borderRadius: 20, border: '1px solid var(--surface-border)',
          padding: 24, boxShadow: 'var(--shadow-card)'
        }}>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: 8 }}>
            Nom de l'établissement
          </label>
          <input
            value={name} onChange={e => setName(e.target.value)}
            style={{
              width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid var(--surface-border)',
              fontSize: 14, boxSizing: 'border-box', marginBottom: 22
            }}
          />

          <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: 8 }}>
            Logo de l'établissement
          </label>
          <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '0 0 14px' }}>
            Remplace le logo "Karaoké Manager" par défaut sur tes écrans de gestion. Image carrée conseillée, 2 Mo max.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 14, border: '1px dashed var(--surface-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-soft)',
              overflow: 'hidden', flexShrink: 0
            }}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <Logo size="sm" withWordmark={false} />
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => fileInputRef.current?.click()} className="glow-hover" style={{
                padding: '9px 16px', borderRadius: 10, border: '1px solid var(--surface-border)',
                background: '#fff', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', cursor: 'pointer'
              }}>
                {logoUrl ? 'Changer le logo' : '+ Ajouter un logo'}
              </button>
              {logoUrl && (
                <button onClick={() => setLogoUrl(null)} style={{
                  padding: '9px 16px', borderRadius: 10, border: 'none',
                  background: '#fee2e2', color: 'var(--danger)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer'
                }}>
                  Retirer (revenir au logo par défaut)
                </button>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />

          <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)', display: 'block', margin: '22px 0 8px' }}>
            Taille d'affichage
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <input
              type="range" min={0.6} max={2} step={0.1} value={logoScale}
              onChange={e => setLogoScale(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: '#7c3aed' }}
            />
            <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink-soft)', minWidth: 36, textAlign: 'right' }}>
              {Math.round(logoScale * 100)}%
            </span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 90,
            background: 'var(--bg-soft)', borderRadius: 12, padding: '14px 10px', marginBottom: 22
          }}>
            <Logo size="md" customSrc={logoUrl} scale={logoScale} />
          </div>

          <button onClick={save} disabled={busy} className="glow-hover" style={{
            width: '100%', marginTop: 10, padding: '13px 18px', borderRadius: 12, border: 'none',
            background: saved ? '#16a34a' : 'var(--accent-gradient)', color: '#fff', fontWeight: 700,
            fontSize: 14, cursor: busy ? 'default' : 'pointer', transition: 'background .2s'
          }}>
            {busy ? 'Enregistrement...' : saved ? '✓ Enregistré' : 'Enregistrer'}
          </button>
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
