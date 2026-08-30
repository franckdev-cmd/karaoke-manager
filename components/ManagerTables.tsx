'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Room, VenueTable, QueueItemDB, RotationStateDB } from '@/lib/supabase/types'
import {
  type Table as RTable, type QueueItem as RQueueItem, type RotationState,
  INITIAL_ROTATION_STATE, getRotationOrder, advanceRotation,
  waitMin, waitLabel, waitColor
} from '@/lib/rotation'
import TableSettingsModal, { type TableFormValues } from './TableSettingsModal'
import TableManageModal from './TableManageModal'
import { resolveOverlap } from '@/lib/floorplan'
import Logo from './Logo'

type Props = {
  venueId: string
  venueName: string
  logoUrl?: string | null
  logoScale?: number
  initialRooms: Room[]
  initialTables: VenueTable[]
  initialQueue: QueueItemDB[]
  initialRotation: RotationStateDB | null
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function genTableCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function dbToRotationState(row: RotationStateDB | null): RotationState {
  if (!row) return INITIAL_ROTATION_STATE
  return {
    currentTableId: row.current_table_id ?? '',
    cycleNumber: row.cycle_number,
    tablesDoneThisCycle: row.tables_done_this_cycle ?? [],
    priorityQueue: row.priority_queue ?? [],
    drainTableId: row.drain_table_id ?? '',
    sosReturnTableId: row.sos_return_table_id ?? '',
    lastCycleTableId: row.last_cycle_table_id ?? '',
    missedLastCycle: row.missed_last_cycle ?? [],
    cycleStartTables: row.cycle_start_tables ?? [],
    emptyPassed: row.empty_passed ?? [],
    sessionStartedAt: row.session_started_at,
  }
}

function rotationStateToDb(venueId: string, s: RotationState) {
  return {
    venue_id: venueId,
    current_table_id: s.currentTableId || null,
    cycle_number: s.cycleNumber,
    tables_done_this_cycle: s.tablesDoneThisCycle,
    priority_queue: s.priorityQueue,
    drain_table_id: s.drainTableId || null,
    sos_return_table_id: s.sosReturnTableId || null,
    last_cycle_table_id: s.lastCycleTableId || null,
    missed_last_cycle: s.missedLastCycle,
    cycle_start_tables: s.cycleStartTables,
    empty_passed: s.emptyPassed,
    session_started_at: s.sessionStartedAt,
    updated_at: new Date().toISOString()
  }
}

export default function ManagerTables({ venueId, venueName, logoUrl, logoScale, initialRooms, initialTables, initialQueue, initialRotation }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [rooms, setRooms] = useState(initialRooms)
  const [tables, setTables] = useState(initialTables)
  const [queue, setQueue] = useState(initialQueue)
  const [rotation, setRotation] = useState<RotationState>(dbToRotationState(initialRotation))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [confirmChanter, setConfirmChanter] = useState<{ queueId: string; singer: string; tableId: string } | null>(null)
  const [settingsTableId, setSettingsTableId] = useState<string | null>(null)
  const [creatingTableInRoom, setCreatingTableInRoom] = useState<string | null>(null)
  const [addSingerTableId, setAddSingerTableId] = useState<string | null>(null)
  const [manageTableId, setManageTableId] = useState<string | null>(null)

  const [showFloorPlan, setShowFloorPlan] = useState(false)
  const [showQueue, setShowQueue] = useState(false)
  const [reorderRoomId, setReorderRoomId] = useState<string | null>(null)
  const [activeRoomId, setActiveRoomId] = useState<string | null>(initialRooms[0]?.id ?? null)
  const [addingRoom, setAddingRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ id: string; moved: boolean; startX: number; startY: number } | null>(null)

  const roomById = useMemo(() => new Map(rooms.map(r => [r.id, r])), [rooms])

  const rTables: RTable[] = useMemo(() => tables.map(t => {
    const room = roomById.get(t.room_id)
    return {
      id: t.id, name: t.name, room_id: t.room_id, pax: t.pax,
      departed: t.departed, is_solo: t.is_solo,
      passages_before_entry: t.passages_before_entry,
      sort_order: (room?.sort_order ?? 0) * 1000 + (t.sort_order ?? 0),
      created_at: t.created_at
    }
  }), [tables, roomById])

  const rQueue: RQueueItem[] = useMemo(() => queue.map(q => ({
    id: q.id, table_id: q.table_id, singer: q.singer, song: q.song, artist: q.artist,
    key: q.key, youtube_link: q.youtube_link, sing_count: q.sing_count, done: q.done,
    registered_at: q.registered_at, device_id: q.device_id ?? undefined,
    linked_singer: q.linked_singer ?? undefined, slot: q.slot, priority_order: q.priority_order
  })), [queue])

  const order = useMemo(() => getRotationOrder(rTables, rQueue, rotation), [rTables, rQueue, rotation])
  const currentTable = order[0] ?? null

  // Quand le cycle se termine et qu'un nouveau commence, les tables qui viennent de
  // réapparaître doivent revenir pliées (sauf la nouvelle table en cours) — pas rester
  // ouvertes si elles l'avaient été manuellement lors du cycle précédent.
  const lastCycleRef = useRef(rotation.cycleNumber)
  useEffect(() => {
    if (rotation.cycleNumber !== lastCycleRef.current) {
      lastCycleRef.current = rotation.cycleNumber
      setExpandedTables(new Set())
    }
  }, [rotation.cycleNumber])

  const settingsTable = tables.find(t => t.id === settingsTableId) ?? null
  const addSingerTable = tables.find(t => t.id === addSingerTableId) ?? null
  const manageTable = tables.find(t => t.id === manageTableId) ?? null
  const activeTableCount = tables.filter(t => !t.departed).length

  const pendingFor = (tableId: string) => rQueue.filter(q => q.table_id === tableId && !q.done)

  const tablesWithSingers = useMemo(() => {
    // Règle simple et fiable : une table avec des chansons en attente s'affiche,
    // sauf si elle a déjà été passée ce cycle-ci (elle réapparaît au cycle suivant).
    return [...tables]
      .filter(t =>
        rQueue.some(q => q.table_id === t.id && !q.done) &&
        !rotation.tablesDoneThisCycle.includes(t.id)
      )
      .sort((a, b) => {
        const ra = roomById.get(a.room_id)?.sort_order ?? 0
        const rb = roomById.get(b.room_id)?.sort_order ?? 0
        if (ra !== rb) return ra - rb
        return (a.sort_order ?? 0) - (b.sort_order ?? 0)
      })
  }, [tables, rQueue, roomById, rotation.tablesDoneThisCycle])

  const toggleExpanded = (tid: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev)
      next.has(tid) ? next.delete(tid) : next.add(tid)
      return next
    })
  }

  async function refreshAll() {
    const [{ data: t }, { data: q }, { data: rs }] = await Promise.all([
      supabase.from('venue_tables').select('*').eq('venue_id', venueId).order('sort_order').order('created_at'),
      supabase.from('queue_items').select('*').eq('venue_id', venueId).eq('done', false).order('registered_at'),
      supabase.from('rotation_state').select('*').eq('venue_id', venueId).maybeSingle()
    ])
    if (t) setTables(t)
    if (q) setQueue(q)
    setRotation(dbToRotationState(rs))
  }

  // Une chanson chantée : si c'était la dernière de la table, on avance automatiquement
  // la rotation. S'il en reste d'autres, la table reste "en cours" tant que le gérant
  // ne clique pas explicitement sur "Table suivante".
  const confirmMarkDone = async () => {
    if (!confirmChanter) return
    setBusy(true)
    const { queueId, tableId } = confirmChanter
    await supabase.from('queue_items').update({ done: true }).eq('id', queueId)
    setConfirmChanter(null)

    const remaining = rQueue.filter(q => q.table_id === tableId && !q.done && q.id !== queueId)
    if (remaining.length === 0) {
      const updatedQueue = rQueue.filter(q => q.id !== queueId)
      const result = advanceRotation(rTables, updatedQueue, rotation, tableId, false)
      await supabase.from('rotation_state').upsert(rotationStateToDb(venueId, result.newState))
    }
    await refreshAll()
    setBusy(false)
  }

  // Bouton "Table suivante" manuel : passe à la table suivante sans marquer les chansons
  // restantes comme chantées. La table réapparaîtra au cycle suivant, à sa position
  // géographique normale — un roulement simple et fiable, sans traitement de faveur qui
  // pourrait rendre l'ordre imprévisible d'un cycle à l'autre.
  const manualNextTable = async (tableId: string) => {
    setBusy(true)
    let result = advanceRotation(rTables, rQueue, rotation, tableId, false)

    // Si le cycle se termine et n'a personne d'autre à proposer, la table reviendrait
    // instantanément en tête sans jamais "disparaître". On force son exclusion pour
    // ce tour, le temps qu'une autre table prenne le relais.
    const wouldLoopBack = getRotationOrder(rTables, rQueue, result.newState)[0]?.id === tableId
    if (wouldLoopBack) {
      result = {
        ...result,
        newState: {
          ...result.newState,
          tablesDoneThisCycle: [...new Set([...result.newState.tablesDoneThisCycle, tableId])]
        }
      }
    }

    await supabase.from('rotation_state').upsert(rotationStateToDb(venueId, result.newState))
    await refreshAll()
    setBusy(false)
  }

  const removeSinger = async (queueId: string) => {
    setBusy(true)
    await supabase.from('queue_items').delete().eq('id', queueId)
    await refreshAll()
    setBusy(false)
  }

  const addSinger = async (tableId: string, values: { singer: string; song: string; artist: string }) => {
    if (!values.singer.trim() || !values.song.trim()) { setError('Renseigne au moins le chanteur et la chanson.'); return false }
    setBusy(true); setError('')
    const { error: err } = await supabase.from('queue_items').insert({
      venue_id: venueId, table_id: tableId,
      singer: values.singer.trim(), song: values.song.trim(), artist: values.artist.trim()
    })
    if (err) { setError(err.message); setBusy(false); return false }
    await refreshAll()
    setBusy(false)
    return true
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Actions de gestion avancée d'une table (menu "🎤 Gérer") ────────────────

  const handleSOS = async (tableId: string) => {
    setBusy(true); setError('')
    const newState: RotationState = {
      ...rotation,
      priorityQueue: [tableId, ...rotation.priorityQueue.filter(id => id !== tableId)],
      sosReturnTableId: currentTable && currentTable.id !== tableId ? currentTable.id : rotation.sosReturnTableId
    }
    await supabase.from('rotation_state').upsert(rotationStateToDb(venueId, newState))
    await refreshAll()
    setBusy(false)
    setManageTableId(null)
  }

  const handlePartir = async (tableId: string) => {
    setBusy(true); setError('')
    await supabase.from('venue_tables').update({ departed: true }).eq('id', tableId)
    await refreshAll()
    setBusy(false)
    setManageTableId(null)
  }

  const handleChangeRoom = async (tableId: string, roomId: string) => {
    setBusy(true); setError('')
    await supabase.from('venue_tables').update({ room_id: roomId }).eq('id', tableId)
    await refreshAll()
    setBusy(false)
  }

  const handleMoveSinger = async (queueId: string, newTableId: string) => {
    setBusy(true); setError('')
    await supabase.from('queue_items').update({ table_id: newTableId }).eq('id', queueId)
    await refreshAll()
    setBusy(false)
  }

  const takePhoto = async (tableId: string, dataUrl: string) => {
    setBusy(true); setError('')
    await supabase.from('table_photos').insert({ venue_id: venueId, table_id: tableId, data_url: dataUrl })
    setBusy(false)
  }

  const fetchPhotos = async (tableId: string) => {
    const { data } = await supabase.from('table_photos').select('*').eq('table_id', tableId).order('created_at', { ascending: false })
    return data ?? []
  }

  const saveTableSettings = async (values: TableFormValues) => {
    if (!settingsTable) return
    setBusy(true); setError('')
    const { error: err } = await supabase.from('venue_tables').update({
      name: values.name, pax: values.pax, free_mode: values.free_mode, free_mode_max: values.free_mode_max
    }).eq('id', settingsTable.id)
    if (err) { setError(err.message); setBusy(false); return }
    setTables(ts => ts.map(t => t.id === settingsTable.id ? { ...t, ...values } : t))
    setBusy(false)
    setSettingsTableId(null)
  }

  const deleteTable = async () => {
    if (!settingsTable) return
    setBusy(true); setError('')
    const { error: err } = await supabase.from('venue_tables').delete().eq('id', settingsTable.id)
    if (err) { setError(err.message); setBusy(false); return }
    setTables(ts => ts.filter(t => t.id !== settingsTable.id))
    setBusy(false)
    setSettingsTableId(null)
  }

  const saveNewTable = async (values: TableFormValues) => {
    if (!creatingTableInRoom) return
    setBusy(true); setError('')
    const roomTablesNow = tables.filter(t => t.room_id === creatingTableInRoom)
    const nextSortOrder = roomTablesNow.length
      ? Math.max(...roomTablesNow.map(t => t.sort_order ?? 0)) + 1
      : 0
    const x0 = clamp(15 + Math.random() * 70, 8, 92)
    const y0 = clamp(15 + Math.random() * 70, 8, 92)
    const { x, y } = resolveOverlap(roomTablesNow.map(t => ({ x: t.x, y: t.y })), x0, y0, 15, 9 / 16)
    const { data, error: err } = await supabase.from('venue_tables')
      .insert({
        venue_id: venueId, room_id: creatingTableInRoom, name: values.name, pax: values.pax,
        free_mode: values.free_mode, free_mode_max: values.free_mode_max,
        code: genTableCode(), sort_order: nextSortOrder, x, y
      })
      .select('*').single()
    if (err) { setError(err.message); setBusy(false); return }
    if (data) setTables(ts => [...ts, data])
    setBusy(false)
    setCreatingTableInRoom(null)
  }

  const addRoom = async () => {
    if (!newRoomName.trim()) return
    setBusy(true); setError('')
    const { data, error: err } = await supabase.from('rooms')
      .insert({ venue_id: venueId, name: newRoomName.trim(), sort_order: rooms.length })
      .select('*').single()
    if (err) { setError(err.message); setBusy(false); return }
    if (data) { setRooms(r => [...r, data]); setActiveRoomId(data.id) }
    setNewRoomName('')
    setAddingRoom(false)
    setBusy(false)
  }

  const removeRoom = async (roomId: string) => {
    setBusy(true); setError('')
    const { error: err } = await supabase.from('rooms').delete().eq('id', roomId)
    if (err) { setError(err.message); setBusy(false); return }
    setRooms(rs => rs.filter(r => r.id !== roomId))
    setTables(ts => ts.filter(t => t.room_id !== roomId))
    if (activeRoomId === roomId) setActiveRoomId(rooms.filter(r => r.id !== roomId)[0]?.id ?? null)
    setBusy(false)
  }

  const saveReorder = async (roomId: string, orderedIds: string[]) => {
    setBusy(true); setError('')
    await Promise.all(orderedIds.map((id, i) =>
      supabase.from('venue_tables').update({ sort_order: i }).eq('id', id)
    ))

    // Un réordonnancement manuel doit primer sur les files internes de rotation
    // (priorité, manqués...) qui pouvaient garder une ancienne table "collée" en tête.
    const roomTableIds = new Set(orderedIds)
    const cleanedState: RotationState = {
      ...rotation,
      priorityQueue: rotation.priorityQueue.filter(id => !roomTableIds.has(id)),
      missedLastCycle: rotation.missedLastCycle.filter(id => !roomTableIds.has(id)),
    }
    await supabase.from('rotation_state').upsert(rotationStateToDb(venueId, cleanedState))

    setTables(ts => ts.map(t => {
      const idx = orderedIds.indexOf(t.id)
      return idx === -1 ? t : { ...t, sort_order: idx }
    }))
    // On repart d'un affichage propre : seule la nouvelle table en cours (déterminée
    // par le nouvel ordre) doit rester dépliée, les autres se replient.
    setExpandedTables(new Set())
    await refreshAll()
    setBusy(false)
    setReorderRoomId(null)
  }

  // Glisser-déposer sur le plan — un vrai seuil de distance évite qu'un simple clic
  // (souvent accompagné d'un minuscule mouvement de souris/doigt) ne soit interprété
  // à tort comme un glissement et ne dérange la position de la table.
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
  const onPointerUp = async (e: React.PointerEvent, id: string) => {
    const wasDrag = dragState.current?.moved
    dragState.current = null
    if (wasDrag) {
      const t = tables.find(t => t.id === id)
      if (t) {
        const others = tables.filter(o => o.id !== id && o.room_id === t.room_id).map(o => ({ x: o.x, y: o.y }))
        const resolved = resolveOverlap(others, t.x, t.y, 15, 9 / 16)
        if (resolved.x !== t.x || resolved.y !== t.y) {
          setTables(ts => ts.map(tt => tt.id === id ? { ...tt, x: resolved.x, y: resolved.y } : tt))
        }
        const { error: err } = await supabase.from('venue_tables').update({ x: resolved.x, y: resolved.y }).eq('id', id)
        if (err) {
          console.error('Échec sauvegarde position table', id, err)
          setError(`Position non enregistrée : ${err.message}`)
        }
      }
    }
    // Un simple clic sur la table (hors glissement) ne fait plus rien : seule la
    // roue dentée ⚙ ouvre le menu de gestion.
  }

  const roomFloorTables = tables.filter(t => t.room_id === activeRoomId)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-soft)', padding: '32px 20px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ marginBottom: 18 }}>
          <Logo size="sm" align="left" customSrc={logoUrl} scale={logoScale} />
        </div>
        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={() => router.push('/onboarding/mode')} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999,
            border: '1px solid var(--surface-border)', background: '#fff', fontSize: 12.5, fontWeight: 600,
            color: 'var(--ink-soft)', cursor: 'pointer'
          }}>
            🏠 Accueil
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => router.push('/settings')} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999,
              border: '1px solid var(--surface-border)', background: '#fff', fontSize: 12.5, fontWeight: 600,
              color: 'var(--ink-soft)', cursor: 'pointer'
            }}>
              ⚙ Paramètres
            </button>
            <button onClick={handleLogout} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999,
              border: '1px solid var(--surface-border)', background: '#fff', fontSize: 12.5, fontWeight: 600,
              color: 'var(--ink-soft)', cursor: 'pointer'
            }}>
              Déconnexion ⏻
            </button>
          </div>
        </div>

        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <div>
            <h1 className="display" style={{ fontSize: 24, margin: 0 }}>{venueName}</h1>
            <p style={{ color: 'var(--ink-soft)', fontSize: 13, margin: '4px 0 0' }}>Cycle n°{rotation.cycleNumber}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-soft)',
              color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, padding: '9px 14px', borderRadius: 999,
              whiteSpace: 'nowrap'
            }}>
              {activeTableCount} table{activeTableCount !== 1 ? 's' : ''} active{activeTableCount !== 1 ? 's' : ''}
            </div>
            <button onClick={refreshAll} style={{
              padding: '9px 16px', borderRadius: 10, border: '1px solid var(--surface-border)',
              background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ink)'
            }}>⟳</button>
          </div>
        </div>

        {error && (
          <div style={{
            background: '#fee2e2', color: 'var(--danger)', fontSize: 12.5, fontWeight: 600,
            padding: '10px 14px', borderRadius: 10, marginBottom: 14
          }}>
            {error}
          </div>
        )}

        {/* Bascule plan de salle */}
        <button
          onClick={() => setShowFloorPlan(s => !s)}
          className="glow-hover"
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderRadius: 14, cursor: 'pointer', marginBottom: 10,
            fontSize: 13.5, fontWeight: 700,
            background: showFloorPlan ? 'var(--accent-soft)' : '#fff',
            color: showFloorPlan ? 'var(--accent)' : 'var(--ink)',
            border: `1.5px solid ${showFloorPlan ? 'var(--accent)' : 'var(--surface-border)'}`
          }}
        >
          <span>🗺️ Plan de salle</span>
          <span className={`chevron-rotate ${showFloorPlan ? 'open' : ''}`} style={{ color: showFloorPlan ? 'var(--accent)' : 'var(--ink-soft)' }}>▾</span>
        </button>

        <div className={`collapsible ${showFloorPlan ? 'open' : ''}`}><div>
          <div style={{ marginBottom: 22, paddingTop: 2 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
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
                      padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                      background: isActive ? 'var(--accent-gradient)' : '#fff',
                      color: isActive ? '#fff' : 'var(--ink)',
                      border: isActive ? '2px solid transparent' : '1px solid var(--surface-border)',
                      boxShadow: isHovered ? '0 0 0 3px var(--accent-soft), 0 8px 22px rgba(124,58,237,.35)' : 'none',
                      transform: isHovered ? 'translateY(-1px)' : 'none',
                      transition: 'box-shadow .2s ease, transform .2s ease'
                    }}>
                    {room.name}
                  </button>
                )
              })}
              {addingRoom ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input autoFocus value={newRoomName} onChange={e => setNewRoomName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addRoom()} placeholder="Nom de la salle"
                    style={{ padding: '7px 10px', borderRadius: 999, border: '1px solid var(--surface-border)', fontSize: 12.5, width: 130 }} />
                  <button onClick={addRoom} className="glow-hover" style={{ padding: '7px 11px', borderRadius: 999, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                  <button onClick={() => setAddingRoom(false)} style={{ padding: '7px 10px', borderRadius: 999, border: '1px solid var(--surface-border)', background: '#fff', fontSize: 11, cursor: 'pointer' }}>✕</button>
                </div>
              ) : (
                <button onClick={() => setAddingRoom(true)} className="glow-hover" style={{
                  padding: '7px 13px', borderRadius: 999, border: '1px dashed var(--accent)',
                  background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer'
                }}>+ Salle</button>
              )}
            </div>

            <div ref={canvasRef} style={{
              position: 'relative', width: '100%', aspectRatio: '16 / 9',
              background: `repeating-linear-gradient(0deg, transparent, transparent 39px, #ece4fb 40px),
                repeating-linear-gradient(90deg, transparent, transparent 39px, #ece4fb 40px), #fff`,
              borderRadius: 18, border: '2px dashed var(--surface-border)', overflow: 'hidden', touchAction: 'none'
            }}>
              {roomFloorTables.map(t => {
                const count = pendingFor(t.id).length
                const isCurrent = currentTable?.id === t.id
                return (
                  <div key={t.id}
                    onPointerDown={e => onPointerDown(e, t.id)}
                    onPointerMove={e => onPointerMove(e, t.id)}
                    onPointerUp={e => onPointerUp(e, t.id)}
                    style={{ position: 'absolute', left: `${t.x}%`, top: `${t.y}%`, transform: 'translate(-50%,-50%)', cursor: 'grab', touchAction: 'none' }}>
                    <div style={{
                      minWidth: 76, padding: '8px 26px 8px 12px', borderRadius: 12, position: 'relative', textAlign: 'center',
                      background: isCurrent ? 'var(--accent-gradient)' : '#fff',
                      border: `2px solid ${isCurrent ? 'transparent' : 'var(--surface-border)'}`,
                      boxShadow: isCurrent ? '0 6px 16px rgba(124,58,237,.3)' : '0 3px 8px rgba(0,0,0,.06)'
                    }}>
                      {count > 0 && <div style={{
                        position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, borderRadius: 999,
                        background: isCurrent ? '#fff' : 'var(--accent)', color: isCurrent ? 'var(--accent)' : '#fff',
                        fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>{count}</div>}
                      <div style={{ fontWeight: 700, fontSize: 12, color: isCurrent ? '#fff' : 'var(--ink)' }}>{t.name}</div>
                      <span
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); setManageTableId(t.id) }}
                        title="Gérer la table"
                        style={{
                          position: 'absolute', bottom: 2, right: 4, fontSize: 12, cursor: 'pointer',
                          color: isCurrent ? 'rgba(255,255,255,.85)' : 'var(--ink-faint)'
                        }}
                      >⚙</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <p style={{ fontSize: 11, color: 'var(--ink-faint)', margin: '8px 0 0' }}>
              Clique sur ⚙ pour gérer une table — QR, ajouter un chanteur, déplacer, priorité... · glisse-la pour la repositionner.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => setCreatingTableInRoom(activeRoomId)} disabled={!activeRoomId} className="glow-hover" style={{
                flex: 1, padding: '9px 14px', borderRadius: 10, border: 'none', background: 'var(--accent-gradient)',
                color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer'
              }}>+ Ajouter une table</button>
              {activeRoomId && (
                <button onClick={() => removeRoom(activeRoomId)} className="glow-hover" style={{
                  padding: '9px 14px', borderRadius: 10, border: 'none', background: '#fee2e2',
                  color: 'var(--danger)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer'
                }}>Supprimer la salle</button>
              )}
            </div>
          </div>
        </div></div>

        <div style={{ marginBottom: 18 }} />

        {/* Bascule file d'attente */}
        <button
          onClick={() => setShowQueue(s => !s)}
          className="glow-hover"
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderRadius: 14, cursor: 'pointer', marginBottom: 10,
            fontSize: 13.5, fontWeight: 700,
            background: showQueue ? 'var(--accent-soft)' : '#fff',
            color: showQueue ? 'var(--accent)' : 'var(--ink)',
            border: `1.5px solid ${showQueue ? 'var(--accent)' : 'var(--surface-border)'}`
          }}
        >
          <span>
            📋 File d'attente
            {tablesWithSingers.length > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 800, background: 'var(--accent)', color: '#fff',
                borderRadius: 999, padding: '2px 8px'
              }}>{tablesWithSingers.length}</span>
            )}
          </span>
          <span className={`chevron-rotate ${showQueue ? 'open' : ''}`} style={{ color: showQueue ? 'var(--accent)' : 'var(--ink-soft)' }}>▾</span>
        </button>

        <div className={`collapsible ${showQueue ? 'open' : ''}`}><div>
          <div style={{ marginTop: 12 }}>
            {rooms.map(room => {
              const roomTables = tablesWithSingers.filter(t => t.room_id === room.id)
              if (!roomTables.length) return null
              return (
                <div key={room.id} style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)' }}>{room.name}</div>
                    <button onClick={() => setReorderRoomId(room.id)} style={{
                      fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'none',
                      border: 'none', cursor: 'pointer', padding: 0
                    }}>↕ Réordonner</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {roomTables.map(t => (
                      <TableCard
                        key={t.id}
                        table={t}
                        pending={pendingFor(t.id)}
                        isCurrent={currentTable?.id === t.id}
                        isMissed={rotation.missedLastCycle.includes(t.id)}
                        isSOS={rotation.priorityQueue.includes(t.id)}
                        isExpanded={currentTable?.id === t.id || expandedTables.has(t.id)}
                        onToggle={() => toggleExpanded(t.id)}
                        onOpenSettings={() => setSettingsTableId(t.id)}
                        onChanter={(queueId, singer) => setConfirmChanter({ queueId, singer, tableId: t.id })}
                        onRemove={removeSinger}
                        onNextTable={() => manualNextTable(t.id)}
                        busy={busy}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
            {!tablesWithSingers.length && (
              <p style={{ fontSize: 13, color: 'var(--ink-faint)', textAlign: 'center', padding: '20px 0' }}>
                Aucun chanteur inscrit pour le moment.
              </p>
            )}
          </div>
        </div></div>
      </div>

      {/* Confirmation "Chanter" */}
      {confirmChanter && (
        <div onClick={() => setConfirmChanter(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(27,17,48,.4)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 70
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 20, padding: 26, width: '100%', maxWidth: 340,
            textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,.25)'
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎤</div>
            <p style={{ fontSize: 14.5, margin: '0 0 20px', color: 'var(--ink)' }}>
              Faire chanter <strong>{confirmChanter.singer}</strong> ?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmChanter(null)} style={{
                flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--surface-border)',
                background: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', color: 'var(--ink)'
              }}>Annuler</button>
              <button onClick={confirmMarkDone} disabled={busy} style={{
                flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#16a34a',
                color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer'
              }}>✓ Oui, chanter</button>
            </div>
          </div>
        </div>
      )}

      {reorderRoomId && (
        <ReorderModal
          roomName={roomById.get(reorderRoomId)?.name ?? ''}
          tables={[...tables].filter(t => t.room_id === reorderRoomId).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))}
          onSave={ids => saveReorder(reorderRoomId, ids)}
          onClose={() => setReorderRoomId(null)}
          busy={busy}
        />
      )}

      {manageTable && (
        <TableManageModal
          table={manageTable}
          roomName={roomById.get(manageTable.room_id)?.name ?? ''}
          rooms={rooms}
          allTables={tables}
          pending={pendingFor(manageTable.id)}
          isSOS={rotation.priorityQueue.includes(manageTable.id)}
          appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ''}
          onClose={() => setManageTableId(null)}
          onAddSinger={() => { setManageTableId(null); setAddSingerTableId(manageTable.id) }}
          onChanter={(queueId, singer) => setConfirmChanter({ queueId, singer, tableId: manageTable.id })}
          onRemoveSinger={removeSinger}
          onMoveSinger={handleMoveSinger}
          onChangeRoom={roomId => handleChangeRoom(manageTable.id, roomId)}
          onPartir={() => handlePartir(manageTable.id)}
          onSOS={() => handleSOS(manageTable.id)}
          onTakePhoto={dataUrl => takePhoto(manageTable.id, dataUrl)}
          fetchPhotos={() => fetchPhotos(manageTable.id)}
          busy={busy}
        />
      )}

      {addSingerTable && (
        <AddSingerModal
          tableName={addSingerTable.name}
          onSubmit={async values => {
            const ok = await addSinger(addSingerTable.id, values)
            if (ok) setAddSingerTableId(null)
          }}
          onClose={() => setAddSingerTableId(null)}
          busy={busy}
          error={error}
        />
      )}

      {settingsTable && (
        <TableSettingsModal
          title="Paramètres de la table"
          initial={{
            name: settingsTable.name, pax: settingsTable.pax,
            free_mode: settingsTable.free_mode, free_mode_max: settingsTable.free_mode_max
          }}
          code={settingsTable.code}
          onSave={saveTableSettings}
          onDelete={deleteTable}
          onClose={() => setSettingsTableId(null)}
          busy={busy}
        />
      )}

      {creatingTableInRoom && (
        <TableSettingsModal
          title="Nouvelle table"
          initial={{ name: `Table ${tables.filter(t => t.room_id === creatingTableInRoom).length + 1}`, pax: 4, free_mode: false, free_mode_max: 6 }}
          onSave={saveNewTable}
          onClose={() => setCreatingTableInRoom(null)}
          busy={busy}
        />
      )}
    </div>
  )
}

// ── Popup de réorganisation des tables (glisser-déposer, comme l'original) ────

function ReorderModal({
  roomName, tables, onSave, onClose, busy
}: {
  roomName: string
  tables: VenueTable[]
  onSave: (orderedIds: string[]) => void
  onClose: () => void
  busy: boolean
}) {
  const [order, setOrder] = useState(tables.map(t => t.id))
  const [dragging, setDragging] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const byId = useMemo(() => new Map(tables.map(t => [t.id, t])), [tables])

  const onDrop = () => {
    if (!dragging || !overId || dragging === overId) { setDragging(null); setOverId(null); return }
    setOrder(prev => {
      const next = [...prev]
      const from = next.indexOf(dragging)
      const to = next.indexOf(overId)
      next.splice(from, 1)
      next.splice(to, 0, dragging)
      return next
    })
    setDragging(null)
    setOverId(null)
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(27,17,48,.4)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 65
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400,
        maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.25)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 className="display" style={{ fontSize: 17, margin: 0 }}>↕ Réordonner</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--ink-faint)' }}>✕</button>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '0 0 16px' }}>
          {roomName} · glisse les tables pour changer l'ordre de passage
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
          {order.map((id, i) => {
            const t = byId.get(id)
            if (!t) return null
            return (
              <div
                key={id}
                draggable
                onDragStart={() => setDragging(id)}
                onDragOver={e => { e.preventDefault(); setOverId(id) }}
                onDrop={onDrop}
                onDragEnd={() => { setDragging(null); setOverId(null) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 10, cursor: 'grab', userSelect: 'none',
                  background: overId === id ? 'var(--accent-soft)' : 'var(--bg-soft)',
                  border: `1.5px solid ${dragging === id ? 'var(--accent)' : 'transparent'}`,
                  opacity: dragging === id ? 0.5 : 1
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>⋮⋮</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', minWidth: 18 }}>{i + 1}</span>
                <span style={{ fontWeight: 700, fontSize: 13.5, flex: 1 }}>{t.name}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{t.pax} pers.</span>
              </div>
            )
          })}
        </div>

        <button onClick={() => onSave(order)} disabled={busy} style={{
          width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'var(--accent-gradient)',
          color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer'
        }}>
          Enregistrer l'ordre
        </button>
      </div>
    </div>
  )
}

// ── Popup d'ajout de chanteur (déclenché uniquement depuis le plan de salle) ──

function AddSingerModal({
  tableName, onSubmit, onClose, busy, error
}: {
  tableName: string
  onSubmit: (values: { singer: string; song: string; artist: string }) => void
  onClose: () => void
  busy: boolean
  error: string
}) {
  const [singer, setSinger] = useState('')
  const [song, setSong] = useState('')
  const [artist, setArtist] = useState('')

  const submit = () => onSubmit({ singer, song, artist })

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(27,17,48,.4)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 65
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380,
        boxShadow: '0 24px 60px rgba(0,0,0,.25)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 className="display" style={{ fontSize: 17, margin: 0 }}>🎤 + Chanteur</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--ink-faint)' }}>✕</button>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '0 0 16px' }}>{tableName}</p>

        {error && (
          <div style={{ background: '#fee2e2', color: 'var(--danger)', fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input autoFocus placeholder="Chanteur" value={singer} onChange={e => setSinger(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--surface-border)', fontSize: 13.5 }} />
          <input placeholder="Chanson" value={song} onChange={e => setSong(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--surface-border)', fontSize: 13.5 }} />
          <input placeholder="Artiste (optionnel)" value={artist} onChange={e => setArtist(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--surface-border)', fontSize: 13.5 }} />
          <button onClick={submit} disabled={busy} style={{
            padding: '12px', borderRadius: 10, border: 'none', background: 'var(--accent-gradient)',
            color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', marginTop: 4
          }}>
            🎤 Ajouter ce chanteur
          </button>
        </div>
      </div>
    </div>
  )
}

function TableCard({
  table, pending, isCurrent, isMissed, isSOS, isExpanded, onToggle, onOpenSettings, onChanter, onRemove,
  onNextTable, busy
}: {
  table: VenueTable
  pending: RQueueItem[]
  isCurrent: boolean
  isMissed: boolean
  isSOS: boolean
  isExpanded: boolean
  onToggle: () => void
  onOpenSettings: () => void
  onChanter: (queueId: string, singer: string) => void
  onRemove: (queueId: string) => void
  onNextTable: () => void
  busy: boolean
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: `2px solid ${isCurrent ? 'var(--accent)' : isMissed ? '#f59e0b' : 'var(--surface-border)'}`,
      overflow: 'hidden', boxShadow: isCurrent ? 'var(--shadow-hover)' : 'none'
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 16px', border: 'none', background: isCurrent ? 'var(--accent-soft)' : '#fff',
          cursor: 'pointer', textAlign: 'left'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="display" style={{ fontSize: 14.5, color: 'var(--ink)' }}>{table.name}</span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{table.pax} pers.</span>
          {table.free_mode && (
            <span style={{ fontSize: 9.5, fontWeight: 800, background: '#f59e0b', color: '#fff', borderRadius: 999, padding: '2px 6px' }}>LIBRE</span>
          )}
          {isCurrent && (
            <span style={{ fontSize: 9.5, fontWeight: 800, background: 'var(--accent)', color: '#fff', borderRadius: 999, padding: '2px 6px' }}>EN COURS</span>
          )}
          {isSOS && (
            <span style={{ fontSize: 9.5, fontWeight: 800, background: 'linear-gradient(135deg,#ef4444,#7f1d1d)', color: '#fff', borderRadius: 999, padding: '2px 6px' }}>🆘 PRIORITÉ</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {pending.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 800, background: 'var(--accent)', color: '#fff',
              borderRadius: 999, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px'
            }}>{pending.length}</span>
          )}
          <span
            onClick={e => { e.stopPropagation(); onOpenSettings() }}
            title="Paramètres"
            style={{ fontSize: 13, color: 'var(--ink-faint)', cursor: 'pointer', padding: 2 }}
          >⚙</span>
          <span className={`chevron-rotate ${isExpanded ? 'open' : ''}`} style={{ fontSize: 11, color: 'var(--ink-soft)' }}>▾</span>
        </div>
      </button>

      <div className={`collapsible ${isExpanded ? 'open' : ''}`}><div>
        <div style={{ padding: '4px 16px 16px', borderTop: '1px solid var(--surface-border)' }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-faint)', margin: '10px 0' }}>Code : {table.code}</div>

          {pending.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
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
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button onClick={() => onChanter(q.id, q.singer)} style={{
                        fontSize: 11, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(34,197,94,.3)',
                        background: 'rgba(34,197,94,.1)', color: '#16a34a', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap'
                      }}>🎤 Chanter</button>
                      <button onClick={() => onRemove(q.id)} title="Retirer" style={{
                        width: 26, height: 26, borderRadius: 8, border: 'none', background: '#fee2e2',
                        color: 'var(--danger)', cursor: 'pointer', fontSize: 12
                      }}>✕</button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', margin: '0 0 4px' }}>Personne dans la file.</p>
          )}

          {isCurrent && pending.length >= 1 && (
            <button onClick={onNextTable} disabled={busy} style={{
              width: '100%', marginTop: 4, padding: '11px', borderRadius: 10, border: 'none',
              background: 'var(--accent-gradient)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer'
            }}>
              Table suivante →
            </button>
          )}
        </div>
      </div></div>
    </div>
  )
}
