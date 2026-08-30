'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import TableSettingsModal, { type TableFormValues } from './TableSettingsModal'
import { resolveOverlap } from '@/lib/floorplan'
import Logo from './Logo'

type TableRow = {
  id: string; name: string; pax: number; code: string | null; x: number; y: number
  room_id: string; free_mode: boolean; free_mode_max: number; sort_order?: number
}
type RoomRow = { id: string; name: string; sort_order: number }

function genTableCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export default function FloorPlanBuilder({
  venueId, logoUrl = null, logoScale = 1, initialRooms, initialTables
}: { venueId: string; logoUrl?: string | null; logoScale?: number; initialRooms: RoomRow[]; initialTables: TableRow[] }) {
  const router = useRouter()
  const supabase = createClient()

  const [rooms, setRooms] = useState<RoomRow[]>(initialRooms)
  const [tables, setTables] = useState<TableRow[]>(initialTables)
  const [activeRoomId, setActiveRoomId] = useState<string | null>(initialRooms[0]?.id ?? null)
  const [newRoomName, setNewRoomName] = useState('')
  const [addingRoom, setAddingRoom] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null)

  // Popup de table : null = fermé, 'new' = création, sinon id de la table à éditer
  const [tableModal, setTableModal] = useState<'new' | string | null>(null)
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ id: string; moved: boolean; startX: number; startY: number } | null>(null)

  const roomTables = tables.filter(t => t.room_id === activeRoomId)
  const editingTable = tableModal && tableModal !== 'new' ? tables.find(t => t.id === tableModal) ?? null : null
  const activeTableCount = tables.length // toutes les tables créées sont "actives" tant qu'elles ne sont pas parties

  // ── Salles ──────────────────────────────────────────────────────────────
  const addRoom = async () => {
    if (!newRoomName.trim()) return
    setBusy(true)
    const { data } = await supabase.from('rooms')
      .insert({ venue_id: venueId, name: newRoomName.trim(), sort_order: rooms.length })
      .select('*').single()
    if (data) {
      setRooms(r => [...r, data])
      setActiveRoomId(data.id)
    }
    setNewRoomName('')
    setAddingRoom(false)
    setBusy(false)
  }

  const removeRoom = async (roomId: string) => {
    await supabase.from('rooms').delete().eq('id', roomId)
    setRooms(rs => rs.filter(r => r.id !== roomId))
    setTables(ts => ts.filter(t => t.room_id !== roomId))
    if (activeRoomId === roomId) {
      const remaining = rooms.filter(r => r.id !== roomId)
      setActiveRoomId(remaining[0]?.id ?? null)
    }
  }

  // ── Tables ──────────────────────────────────────────────────────────────
  const openCreateTable = () => {
    if (!activeRoomId) return
    const roomTablesNow = tables.filter(t => t.room_id === activeRoomId)
    setPendingPos(resolveOverlap(
      roomTablesNow.map(t => ({ x: t.x, y: t.y })),
      15 + Math.random() * 70,
      15 + Math.random() * 70,
      15, 10 / 16
    ))
    setTableModal('new')
  }

  const saveNewTable = async (values: TableFormValues) => {
    if (!activeRoomId || !pendingPos) return
    setBusy(true)
    const roomTablesNow = tables.filter(t => t.room_id === activeRoomId)
    const nextSortOrder = roomTablesNow.length
      ? Math.max(...roomTablesNow.map(t => t.sort_order ?? 0)) + 1
      : 0
    const { data } = await supabase.from('venue_tables')
      .insert({
        venue_id: venueId, room_id: activeRoomId, name: values.name, pax: values.pax,
        free_mode: values.free_mode, free_mode_max: values.free_mode_max,
        code: genTableCode(), sort_order: nextSortOrder, x: pendingPos.x, y: pendingPos.y
      })
      .select('*').single()
    if (data) setTables(ts => [...ts, data])
    setBusy(false)
    setTableModal(null)
    setPendingPos(null)
  }

  const saveEditedTable = async (values: TableFormValues) => {
    if (!editingTable) return
    setBusy(true)
    await supabase.from('venue_tables').update({
      name: values.name, pax: values.pax, free_mode: values.free_mode, free_mode_max: values.free_mode_max
    }).eq('id', editingTable.id)
    setTables(ts => ts.map(t => t.id === editingTable.id ? { ...t, ...values } : t))
    setBusy(false)
    setTableModal(null)
  }

  const deleteTable = async () => {
    if (!editingTable) return
    setBusy(true)
    await supabase.from('venue_tables').delete().eq('id', editingTable.id)
    setTables(ts => ts.filter(t => t.id !== editingTable.id))
    setBusy(false)
    setTableModal(null)
  }

  const persistPosition = async (id: string, x: number, y: number) => {
    const { error: err } = await supabase.from('venue_tables').update({ x, y }).eq('id', id)
    if (err) {
      console.error('Échec sauvegarde position table', id, err)
      setError(`Position non enregistrée : ${err.message}`)
    }
  }

  // ── Glisser-déposer ───────────────────────────────────────────────────────
  // Un vrai seuil de distance évite qu'un simple clic (souvent accompagné d'un
  // minuscule mouvement de souris/doigt) ne soit interprété à tort comme un
  // glissement et ne dérange la position de la table.
  const DRAG_THRESHOLD_PX = 6
  const onPointerDown = (e: React.PointerEvent, id: string) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = { id, moved: false, startX: e.clientX, startY: e.clientY }
  }

  const onPointerMove = (e: React.PointerEvent, id: string) => {
    if (!dragState.current || dragState.current.id !== id || !canvasRef.current) return
    if (e.buttons === 0) return
    const dist = Math.hypot(e.clientX - dragState.current.startX, e.clientY - dragState.current.startY)
    if (!dragState.current.moved && dist < DRAG_THRESHOLD_PX) return
    dragState.current.moved = true
    const rect = canvasRef.current.getBoundingClientRect()
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 4, 96)
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 4, 96)
    setTables(ts => ts.map(t => t.id === id ? { ...t, x, y } : t))
  }

  const onPointerUp = (e: React.PointerEvent, id: string) => {
    const wasDrag = dragState.current?.moved
    dragState.current = null
    if (wasDrag) {
      const t = tables.find(t => t.id === id)
      if (t) {
        const others = tables.filter(o => o.id !== id && o.room_id === t.room_id).map(o => ({ x: o.x, y: o.y }))
        const resolved = resolveOverlap(others, t.x, t.y, 15, 10 / 16)
        if (resolved.x !== t.x || resolved.y !== t.y) {
          setTables(ts => ts.map(tt => tt.id === id ? { ...tt, x: resolved.x, y: resolved.y } : tt))
        }
        persistPosition(id, resolved.x, resolved.y)
      }
    } else {
      setTableModal(id)
    }
  }

  const canFinish = rooms.length > 0 && rooms.every(r => tables.some(t => t.room_id === r.id))

  const finish = async () => {
    setBusy(true)
    await supabase.from('venues').update({ onboarding_done: true }).eq('id', venueId)
    router.push('/manager')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-soft)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 18 }}>
          <Logo size="sm" align="left" customSrc={logoUrl} scale={logoScale} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <button onClick={() => router.push('/onboarding/mode')} style={{
              display: 'block', border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 700,
              fontSize: 12.5, cursor: 'pointer', padding: 0, marginBottom: 8
            }}>← Changer de mode</button>
            <h1 className="display" style={{ fontSize: 26, margin: 0 }}>Organise tes salles</h1>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-soft)',
            color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999,
            whiteSpace: 'nowrap'
          }}>
            {activeTableCount} table{activeTableCount !== 1 ? 's' : ''} active{activeTableCount !== 1 ? 's' : ''}
          </div>
        </div>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, margin: '0 0 24px' }}>
          Navigue entre tes salles avec les onglets, et place chaque table où elle se trouve vraiment
          en la glissant sur le plan.
        </p>

        {error && (
          <div style={{
            background: '#fee2e2', color: 'var(--danger)', fontSize: 12.5, fontWeight: 600,
            padding: '10px 14px', borderRadius: 10, marginBottom: 18
          }}>
            {error}
          </div>
        )}

        {/* Onglets de salles */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
          {rooms.map(room => {
            const isActive = activeRoomId === room.id
            const isHovered = hoveredRoomId === room.id
            return (
              <button
                key={room.id}
                onClick={() => setActiveRoomId(room.id)}
                onMouseEnter={() => setHoveredRoomId(room.id)}
                onMouseLeave={() => setHoveredRoomId(null)}
                style={{
                  padding: '9px 18px', borderRadius: 999, cursor: 'pointer',
                  fontSize: 13.5, fontWeight: 700,
                  background: isActive ? 'var(--accent-gradient)' : '#fff',
                  color: isActive ? '#fff' : 'var(--ink)',
                  boxShadow: isHovered
                    ? '0 0 0 3px var(--accent-soft), 0 8px 22px rgba(124,58,237,.35)'
                    : isActive ? '0 6px 16px rgba(124,58,237,.28)' : '0 1px 4px rgba(0,0,0,.06)',
                  border: isActive ? '2px solid transparent' : '1px solid var(--surface-border)',
                  transform: isHovered ? 'translateY(-1px)' : 'none',
                  transition: 'box-shadow .2s ease, transform .2s ease'
                }}
              >
                {room.name} <span style={{ opacity: 0.7, fontWeight: 500 }}>· {tables.filter(t => t.room_id === room.id).length}</span>
              </button>
            )
          })}

          {addingRoom ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                autoFocus value={newRoomName} onChange={e => setNewRoomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRoom()}
                placeholder="Nom de la salle"
                style={{ padding: '9px 12px', borderRadius: 999, border: '1px solid var(--surface-border)', fontSize: 13.5, width: 150 }}
              />
              <button onClick={addRoom} disabled={busy} style={{
                padding: '9px 14px', borderRadius: 999, border: 'none', background: 'var(--accent)',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}>✓</button>
              <button onClick={() => setAddingRoom(false)} style={{
                padding: '9px 12px', borderRadius: 999, border: '1px solid var(--surface-border)',
                background: '#fff', fontSize: 13, cursor: 'pointer'
              }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setAddingRoom(true)} className="glow-hover" style={{
              padding: '9px 16px', borderRadius: 999, border: '1px dashed var(--accent)',
              background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer'
            }}>
              + Salle
            </button>
          )}
        </div>

        {!activeRoomId ? (
          <div style={{
            background: '#fff', borderRadius: 20, border: '1px dashed var(--surface-border)',
            padding: 40, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 14
          }}>
            Crée une première salle pour commencer à placer des tables.
          </div>
        ) : (
          <>
            {/* Plan de salle */}
            <div
              ref={canvasRef}
              style={{
                position: 'relative', width: '100%', aspectRatio: '16 / 10',
                background: `
                  repeating-linear-gradient(0deg, transparent, transparent 39px, #ece4fb 40px),
                  repeating-linear-gradient(90deg, transparent, transparent 39px, #ece4fb 40px),
                  #fff`,
                borderRadius: 20, border: '2px dashed var(--surface-border)',
                marginBottom: 14, overflow: 'hidden', touchAction: 'none'
              }}
            >
              {roomTables.map(t => (
                <div
                  key={t.id}
                  onPointerDown={e => onPointerDown(e, t.id)}
                  onPointerMove={e => onPointerMove(e, t.id)}
                  onPointerUp={e => onPointerUp(e, t.id)}
                  style={{
                    position: 'absolute', left: `${t.x}%`, top: `${t.y}%`,
                    transform: 'translate(-50%, -50%)', cursor: 'grab', userSelect: 'none',
                    touchAction: 'none'
                  }}
                >
                  <div style={{
                    minWidth: 88, padding: '10px 14px', borderRadius: 14, position: 'relative',
                    background: '#fff', border: `2px solid ${t.free_mode ? '#f59e0b' : 'var(--accent)'}`,
                    boxShadow: '0 4px 14px rgba(124,58,237,.18)', textAlign: 'center'
                  }}>
                    {t.free_mode && (
                      <div style={{
                        position: 'absolute', top: -8, right: -8, fontSize: 9.5, fontWeight: 800,
                        background: '#f59e0b', color: '#fff', borderRadius: 999, padding: '2px 6px'
                      }}>LIBRE</div>
                    )}
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{t.name}</div>
                    <div style={{ fontSize: 10.5, marginTop: 2, color: 'var(--ink-soft)' }}>{t.pax} pers.</div>
                  </div>
                </div>
              ))}

              {!roomTables.length && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--ink-faint)', fontSize: 13.5, textAlign: 'center', padding: 20
                }}>
                  Aucune table dans cette salle.<br />Clique sur "+ Ajouter une table" ci-dessous.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button onClick={openCreateTable} className="glow-hover" style={{
                flex: 1, padding: '12px 16px', borderRadius: 12, border: 'none',
                background: 'var(--accent-gradient)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer'
              }}>
                + Ajouter une table
              </button>
              <button onClick={() => removeRoom(activeRoomId)} className="glow-hover" style={{
                padding: '12px 16px', borderRadius: 12, border: 'none',
                background: '#fee2e2', color: 'var(--danger)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer'
              }}>
                Supprimer la salle
              </button>
            </div>
          </>
        )}

        <button
          onClick={finish}
          disabled={!canFinish || busy}
          style={{
            width: '100%', padding: '14px 18px', borderRadius: 14, border: 'none',
            background: canFinish ? 'var(--accent-gradient)' : '#e5e0f0',
            color: canFinish ? '#fff' : 'var(--ink-faint)', fontWeight: 700, fontSize: 14.5,
            cursor: canFinish && !busy ? 'pointer' : 'default'
          }}
        >
          {canFinish ? "Terminer et aller au manager →" : 'Chaque salle doit avoir au moins une table'}
        </button>
      </div>

      {tableModal === 'new' && (
        <TableSettingsModal
          title="Nouvelle table"
          initial={{ name: `Table ${roomTables.length + 1}`, pax: 4, free_mode: false, free_mode_max: 6 }}
          onSave={saveNewTable}
          onClose={() => { setTableModal(null); setPendingPos(null) }}
          busy={busy}
        />
      )}

      {editingTable && (
        <TableSettingsModal
          title="Modifier la table"
          initial={{
            name: editingTable.name, pax: editingTable.pax,
            free_mode: editingTable.free_mode, free_mode_max: editingTable.free_mode_max
          }}
          code={editingTable.code}
          onSave={saveEditedTable}
          onDelete={deleteTable}
          onClose={() => setTableModal(null)}
          busy={busy}
        />
      )}
    </div>
  )
}
