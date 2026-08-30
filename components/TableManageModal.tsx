'use client'
import { useState, useRef } from 'react'
import type { Room, VenueTable, TablePhoto } from '@/lib/supabase/types'
import { type QueueItem as RQueueItem, waitMin, waitLabel, waitColor } from '@/lib/rotation'

type View = 'menu' | 'qr' | 'move' | 'room' | 'photos' | 'singers' | 'confirmPartir'

type Props = {
  table: VenueTable
  roomName: string
  rooms: Room[]
  allTables: VenueTable[]
  pending: RQueueItem[]
  isSOS: boolean
  appUrl: string
  onClose: () => void
  onAddSinger: () => void
  onChanter: (queueId: string, singer: string) => void
  onRemoveSinger: (queueId: string) => void
  onMoveSinger: (queueId: string, newTableId: string) => void
  onChangeRoom: (roomId: string) => void
  onPartir: () => void
  onSOS: () => void
  onTakePhoto: (dataUrl: string) => void
  fetchPhotos: () => Promise<TablePhoto[]>
  busy: boolean
}

export default function TableManageModal({
  table, roomName, rooms, allTables, pending, isSOS, appUrl, onClose, onAddSinger, onChanter, onRemoveSinger,
  onMoveSinger, onChangeRoom, onPartir, onSOS, onTakePhoto, fetchPhotos, busy
}: Props) {
  const [view, setView] = useState<View>('menu')
  const [photos, setPhotos] = useState<TablePhoto[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const openPhotos = async () => {
    setView('photos')
    const p = await fetchPhotos()
    setPhotos(p)
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') onTakePhoto(reader.result)
      setView('menu')
    }
    reader.readAsDataURL(file)
  }

  const registerUrl = `${appUrl}/t/${table.code}`
  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(registerUrl)}`

  const btn = (icon: string, label: string, onClick: () => void, color = 'var(--ink)') => (
    <button onClick={onClick} disabled={busy} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      padding: '18px 10px', borderRadius: 14, border: '1px solid var(--surface-border)',
      background: '#fff', cursor: busy ? 'default' : 'pointer'
    }}>
      <span style={{ fontSize: 26 }}>{icon}</span>
      <span style={{ fontSize: 11.5, fontWeight: 700, color, textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
    </button>
  )

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(27,17,48,.45)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 80
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 22, padding: 24, width: '100%', maxWidth: 420,
        maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            {view !== 'menu' && (
              <button onClick={() => setView('menu')} style={{
                border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 700,
                fontSize: 12.5, cursor: 'pointer', padding: 0, marginBottom: 4
              }}>← Retour</button>
            )}
            <h3 className="display" style={{ fontSize: 19, margin: 0 }}>{table.name}</h3>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '2px 0 0' }}>
              {roomName} · {table.pax} pers.{isSOS && ' · 🆘 priorité active'}
            </p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 19, cursor: 'pointer', color: 'var(--ink-faint)' }}>✕</button>
        </div>

        <div style={{ marginTop: 18 }}>
          {view === 'menu' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {btn('📱', 'QR Code', () => setView('qr'))}
              {btn('🎤', 'Ajouter chanteur', onAddSinger, 'var(--accent)')}
              {btn('↔️', 'Déplacer chanteurs', () => setView('move'))}
              {btn('🚪', 'Table partie', () => setView('confirmPartir'), '#ea580c')}
              {btn('📦', 'Changer de salle', () => setView('room'))}
              {btn('📷', 'Photographier', () => fileInputRef.current?.click())}
              {btn('🚀', 'Priorité', onSOS, '#ef4444')}
              {btn('🖼️', 'Historique photos', openPhotos)}
              {btn('👁️', 'Voir chanteurs', () => setView('singers'))}
            </div>
          )}

          {view === 'qr' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                display: 'inline-block', padding: 14, borderRadius: 16, background: 'var(--bg-soft)',
                border: '1px solid var(--surface-border)'
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrImg} alt={`QR ${table.name}`} width={200} height={200} style={{ display: 'block' }} />
              </div>
              <div className="mono" style={{
                marginTop: 14, fontSize: 13, letterSpacing: 2, color: 'var(--ink-soft)',
                background: 'var(--bg-soft)', borderRadius: 8, padding: '8px 12px'
              }}>
                {table.code}
              </div>
            </div>
          )}

          {view === 'move' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pending.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--ink-faint)', textAlign: 'center', padding: '10px 0' }}>Personne à déplacer.</p>
              )}
              {pending.map(q => (
                <div key={q.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 12px', background: 'var(--bg-soft)', borderRadius: 12, gap: 8
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{q.singer}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.song}</div>
                  </div>
                  <select
                    defaultValue=""
                    onChange={e => { if (e.target.value) onMoveSinger(q.id, e.target.value) }}
                    style={{ fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--surface-border)' }}
                  >
                    <option value="" disabled>→ Table...</option>
                    {allTables.filter(t => t.id !== table.id && !t.departed).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {view === 'room' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rooms.map(r => (
                <button key={r.id} onClick={() => { onChangeRoom(r.id); onClose() }} disabled={r.id === table.room_id || busy} style={{
                  padding: '11px 14px', borderRadius: 10, textAlign: 'left', cursor: r.id === table.room_id ? 'default' : 'pointer',
                  border: `1.5px solid ${r.id === table.room_id ? 'var(--accent)' : 'var(--surface-border)'}`,
                  background: r.id === table.room_id ? 'var(--accent-soft)' : '#fff',
                  color: r.id === table.room_id ? 'var(--accent)' : 'var(--ink)', fontWeight: 700, fontSize: 13.5
                }}>
                  {r.name} {r.id === table.room_id && '(actuelle)'}
                </button>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />

          {view === 'photos' && (
            <div>
              {photos === null ? (
                <p style={{ fontSize: 13, color: 'var(--ink-faint)', textAlign: 'center', padding: '20px 0' }}>Chargement...</p>
              ) : photos.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink-faint)', textAlign: 'center', padding: '20px 0' }}>Aucune photo pour cette table.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {photos.map(p => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.id} src={p.data_url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10 }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'singers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pending.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--ink-faint)', textAlign: 'center', padding: '10px 0' }}>Personne dans la file.</p>
              )}
              {pending.map(q => {
                const m = waitMin(q)
                return (
                  <div key={q.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '9px 12px', background: 'var(--bg-soft)', borderRadius: 12
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{q.singer}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{q.song}{q.artist ? ` — ${q.artist}` : ''}</div>
                      <div className="mono" style={{ fontSize: 10.5, color: waitColor(m), marginTop: 2 }}>{waitLabel(m)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => onChanter(q.id, q.singer)} style={{
                        fontSize: 11, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(34,197,94,.3)',
                        background: 'rgba(34,197,94,.1)', color: '#16a34a', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap'
                      }}>🎤 Chanter</button>
                      <button onClick={() => onRemoveSinger(q.id)} style={{
                        width: 26, height: 26, borderRadius: 8, border: 'none', background: '#fee2e2',
                        color: 'var(--danger)', cursor: 'pointer', fontSize: 12
                      }}>✕</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {view === 'confirmPartir' && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🚪</div>
              <p style={{ fontSize: 14, color: 'var(--ink)', margin: '0 0 20px' }}>
                <strong>{table.name}</strong> quitte définitivement la rotation. Confirmer ?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setView('menu')} style={{
                  flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--surface-border)',
                  background: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', color: 'var(--ink)'
                }}>Annuler</button>
                <button onClick={onPartir} disabled={busy} style={{
                  flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#ea580c',
                  color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer'
                }}>Confirmer</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
