'use client'

type Props = {
  size?: 'sm' | 'md' | 'lg'
  withWordmark?: boolean
  align?: 'center' | 'left'
  customSrc?: string | null
}

const SIZES = {
  sm: { icon: 30, gap: 8, title: 14, sub: 9 },
  md: { icon: 42, gap: 10, title: 18, sub: 10.5 },
  lg: { icon: 56, gap: 12, title: 23, sub: 12 }
}

let uid = 0

export default function Logo({ size = 'md', withWordmark, align = 'center', customSrc }: Props) {
  const s = SIZES[size]
  // Un logo perso a vocation à représenter la marque à lui seul : par défaut on masque
  // le wordmark "Karaoké Manager" dans ce cas, sauf si explicitement demandé.
  const showWordmark = withWordmark ?? !customSrc
  // Identifiant unique par instance pour éviter les collisions d'id de gradient SVG
  // si le logo apparaît plusieurs fois sur la même page.
  const gradId = `logoMicGrad-${size}-${(uid++).toString(36)}`

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: s.gap,
      flexDirection: align === 'center' ? 'column' : 'row',
      textAlign: align === 'center' ? 'center' : 'left'
    }}>
      {customSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={customSrc} alt="Logo"
          style={{ width: s.icon * 1.4, height: s.icon * 1.4, objectFit: 'contain', flexShrink: 0, borderRadius: 10 }}
        />
      ) : (
        <svg width={s.icon} height={s.icon} viewBox="0 0 64 64" style={{ flexShrink: 0, display: 'block' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7c3aed" />
              <stop offset="1" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <rect x="24" y="6" width="16" height="28" rx="8" fill={`url(#${gradId})`} />
          <path d="M16 28c0 10 7.2 17 16 17s16-7 16-17" stroke={`url(#${gradId})`} strokeWidth="4" fill="none" strokeLinecap="round" />
          <line x1="32" y1="45" x2="32" y2="56" stroke={`url(#${gradId})`} strokeWidth="4" strokeLinecap="round" />
          <line x1="22" y1="56" x2="42" y2="56" stroke={`url(#${gradId})`} strokeWidth="4" strokeLinecap="round" />
        </svg>
      )}

      {showWordmark && (
        <div>
          <div className="display" style={{
            fontSize: s.title, lineHeight: 1.1, color: 'var(--ink)',
            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
          }}>
            Karaoké Manager
          </div>
          {size !== 'sm' && (
            <div style={{
              fontSize: s.sub, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
              color: 'var(--ink-faint)', marginTop: 1
            }}>
              Pro Edition
            </div>
          )}
        </div>
      )}
    </div>
  )
}
