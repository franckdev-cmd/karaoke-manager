'use client'
import { useState } from 'react'

export type TableFormValues = { name: string; pax: number; free_mode: boolean; free_mode_max: number }

type Props = {
  title: string
  initial: TableFormValues
  code?: string | null
  onSave: (values: TableFormValues) => void
  onDelete?: () => void
  onClose: () => void
  busy?: boolean
}

export default function TableSettingsModal({ title, initial, code, onSave, onDelete, onClose, busy }: Props) {
  const [name, setName] = useState(initial.name)
  const [pax, setPax] = useState(initial.pax)
  const [freeMode, setFreeMode] = useState(initial.free_mode)
  const [freeModeMax, setFreeModeMax] = useState(initial.free_mode_max)

  const save = () => {
    if (!name.trim()) return
    onSave({ name: name.trim(), pax: Math.max(1, pax), free_mode: freeMode, free_mode_max: Math.max(1, freeModeMax) })
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(27,17,48,.35)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 60
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380,
        boxShadow: '0 24px 60px rgba(0,0,0,.25)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 className="display" style={{ fontSize: 17, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{
            border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--ink-faint)'
          }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: 5 }}>
              Nom de la table
            </label>
            <input
              value={name} onChange={e => setName(e.target.value)} autoFocus
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--surface-border)', fontSize: 13.5, boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: 5 }}>
              Nombre de personnes
            </label>
            <input
              type="number" min={1} value={pax} onChange={e => setPax(parseInt(e.target.value) || 1)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--surface-border)', fontSize: 13.5, boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: 5 }}>
              Mode de la table
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setFreeMode(false)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  border: `2px solid ${!freeMode ? 'var(--accent)' : 'var(--surface-border)'}`,
                  background: !freeMode ? 'var(--accent-soft)' : '#fff',
                  color: !freeMode ? 'var(--accent)' : 'var(--ink-soft)'
                }}
              >
                Normal
              </button>
              <button
                onClick={() => setFreeMode(true)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  border: `2px solid ${freeMode ? 'var(--accent)' : 'var(--surface-border)'}`,
                  background: freeMode ? 'var(--accent-soft)' : '#fff',
                  color: freeMode ? 'var(--accent)' : 'var(--ink-soft)'
                }}
              >
                Libre
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--ink-faint)', margin: '6px 0 0' }}>
              {freeMode
                ? "Les chanteurs de cette table s'enchaînent librement, sans attendre leur tour dans la rotation générale."
                : 'La table suit la rotation normale, un ou deux chanteurs à la fois.'}
            </p>
          </div>

          {freeMode && (
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: 5 }}>
                Chanteurs simultanés max.
              </label>
              <input
                type="number" min={1} value={freeModeMax} onChange={e => setFreeModeMax(parseInt(e.target.value) || 1)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--surface-border)', fontSize: 13.5, boxSizing: 'border-box' }}
              />
            </div>
          )}

          {code && (
            <div className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)', background: 'var(--bg-soft)', borderRadius: 8, padding: '8px 10px' }}>
              Code d'accès : {code}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          {onDelete && (
            <button onClick={onDelete} disabled={busy} className="glow-hover" style={{
              padding: '11px 16px', borderRadius: 10, border: 'none', background: '#fee2e2',
              color: 'var(--danger)', fontWeight: 700, fontSize: 13, cursor: 'pointer'
            }}>
              Supprimer
            </button>
          )}
          <button onClick={save} disabled={busy} className="glow-hover" style={{
            flex: 1, padding: '11px 16px', borderRadius: 10, border: 'none', background: 'var(--accent-gradient)',
            color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer'
          }}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
