'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup' | 'sent'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (!email.trim() || !password) { setError('Renseigne un email et un mot de passe.'); return }
    if (mode === 'signup' && password.length < 6) { setError('6 caractères minimum.'); return }

    setLoading(true)
    const supabase = createClient()

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
      })
      if (error) {
        setError(error.message === 'User already registered'
          ? 'Un compte existe déjà avec cet email. Connecte-toi plutôt.'
          : "Inscription impossible. Réessaie.")
        setLoading(false)
        return
      }
      setMode('sent')
      setLoading(false)
      return
    }

    // mode === 'login'
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Email ou mot de passe incorrect.'
        : "Connexion impossible. Réessaie.")
      setLoading(false)
      return
    }
    router.push('/onboarding')
    router.refresh()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--surface-border)',
    fontSize: 14.5, outline: 'none', marginBottom: 12, boxSizing: 'border-box'
  }

  if (mode === 'sent') {
    return (
      <Shell>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
          <h1 className="display" style={{ fontSize: 22, margin: '0 0 8px' }}>Vérifie ta boîte mail</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            On a envoyé un lien de confirmation à <strong>{email}</strong>. Clique dessus pour activer ton compte,
            tu seras redirigé automatiquement ici.
          </p>
          <button onClick={() => setMode('login')} style={{
            marginTop: 18, background: 'none', border: 'none', color: 'var(--accent)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline'
          }}>
            ← Retour à la connexion
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="display" style={{ fontSize: 24, margin: '0 0 4px', textAlign: 'center' }}>
        Karaoké Manager
      </h1>
      <p style={{ color: 'var(--ink-soft)', fontSize: 13.5, textAlign: 'center', margin: '0 0 26px' }}>
        {mode === 'login' ? 'Connecte-toi pour gérer ton établissement.' : 'Crée ton compte en quelques secondes.'}
      </p>

      {error && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 12, textAlign: 'center' }}>{error}</div>}

      <input
        style={inputStyle} type="email" placeholder="Adresse email" value={email}
        onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
      />
      <input
        style={inputStyle} type="password" placeholder="Mot de passe" value={password}
        onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
      />

      <button
        onClick={submit} disabled={loading}
        style={{
          width: '100%', padding: '13px 18px', borderRadius: 14, border: 'none',
          background: 'var(--accent-gradient)', color: '#fff', fontWeight: 700, fontSize: 14.5,
          cursor: loading ? 'default' : 'pointer', boxShadow: '0 8px 20px rgba(124,58,237,.25)',
          marginTop: 4
        }}
      >
        {loading ? 'Un instant...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
      </button>

      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--ink-soft)' }}>
        {mode === 'login' ? (
          <>Pas encore de compte ?{' '}
            <button onClick={() => { setMode('signup'); setError('') }} style={linkBtn}>Créer un compte</button>
          </>
        ) : (
          <>Déjà un compte ?{' '}
            <button onClick={() => { setMode('login'); setError('') }} style={linkBtn}>Se connecter</button>
          </>
        )}
      </div>
    </Shell>
  )
}

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700,
  fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at 20% 20%, #f3ebff 0%, #ffffff 55%)', padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 380, background: '#fff', borderRadius: 24,
        border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-card)',
        padding: '40px 32px'
      }}>
        <svg width="56" height="56" viewBox="0 0 64 64" style={{ margin: '0 auto 18px', display: 'block' }}>
          <defs>
            <linearGradient id="micGrad2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7c3aed" />
              <stop offset="1" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <rect x="24" y="6" width="16" height="28" rx="8" fill="url(#micGrad2)" />
          <path d="M16 28c0 10 7.2 17 16 17s16-7 16-17" stroke="url(#micGrad2)" strokeWidth="4" fill="none" strokeLinecap="round" />
          <line x1="32" y1="45" x2="32" y2="56" stroke="url(#micGrad2)" strokeWidth="4" strokeLinecap="round" />
          <line x1="22" y1="56" x2="42" y2="56" stroke="url(#micGrad2)" strokeWidth="4" strokeLinecap="round" />
        </svg>
        {children}
      </div>
    </div>
  )
}
