// ═══════════════════════════════════════════════════════════════
// Karaoké Manager — Rotation (mode "Tables")
// Adapté de nyc-karaoke/lib/rotation.ts pour un nombre de salles
// quelconque (au lieu de 'karaoke' | 'bar' fixes).
//
// Règles :
//   1. Ordre géographique = sort_order global (le DJ range ses tables
//      salle par salle, donc l'ordre des salles est encodé dedans)
//   2. Tables non inscrites → ignorées ce cycle → missed au suivant
//   3. Missed → Normaux (dans l'ordre géographique)
//   4. SOS / priorité → en tête absolue
//   5. Fin de cycle = plus de tables inscrites non passées
// ═══════════════════════════════════════════════════════════════

export const URGENT_MIN = 60
export const WARN_MIN   = 30

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Table {
  id: string
  name: string
  room_id: string
  pax: number
  departed?: boolean
  is_solo: boolean
  passages_before_entry: number
  sort_order?: number | null
  created_at?: string
}

export interface QueueItem {
  id: string
  table_id: string
  singer: string
  song: string
  artist?: string
  key?: string
  youtube_link?: string
  sing_count: number
  done: boolean
  registered_at: string
  device_id?: string
  linked_singer?: string
  slot?: number | null
  priority_order?: number | null
}

export interface RotationState {
  currentTableId:       string
  cycleNumber:          number
  tablesDoneThisCycle:  string[]
  priorityQueue:        string[]
  drainTableId:         string
  sosReturnTableId:     string
  lastCycleTableId:     string
  missedLastCycle:      string[]
  cycleStartTables:     string[]
  emptyPassed:          string[]
  sessionStartedAt:     string
}

export const INITIAL_ROTATION_STATE: RotationState = {
  currentTableId:      '',
  cycleNumber:         1,
  tablesDoneThisCycle: [],
  priorityQueue:       [],
  drainTableId:        '',
  sosReturnTableId:    '',
  lastCycleTableId:    '',
  missedLastCycle:     [],
  cycleStartTables:    [],
  emptyPassed:         [],
  sessionStartedAt:    new Date().toISOString(),
}

// ── Tri géographique (ordre manuel du DJ, salle par salle) ────────────────────

export function sortClockwise(tables: Table[]): Table[] {
  return [...tables].sort((a, b) => {
    const diff = (a.sort_order ?? 9999) - (b.sort_order ?? 9999)
    if (diff !== 0) return diff
    // Sécurité : si deux tables partagent le même sort_order (ne devrait pas arriver,
    // mais peut se produire suite à une création concurrente), on garde un ordre
    // stable et reproductible plutôt que de dépendre de l'ordre renvoyé par la requête.
    if (a.created_at && b.created_at) return a.created_at.localeCompare(b.created_at)
    return a.id.localeCompare(b.id)
  })
}

function geoSort(all: Table[], subset: Table[]): Table[] {
  const allSorted = sortClockwise(all.filter(t => !t.departed))
  const ids = new Set(subset.map(t => t.id))
  return allSorted.filter(t => ids.has(t.id))
}

// ── Tables actives ────────────────────────────────────────────────────────────

export function getActiveTables(tables: Table[], pending: QueueItem[], doneThisCycle?: string[], emptyPassed?: string[]): Table[] {
  const excluded = [...(doneThisCycle ?? []), ...(emptyPassed ?? [])]
  return sortClockwise(
    tables.filter(t =>
      !t.departed &&
      (t.passages_before_entry ?? 0) === 0 &&
      !excluded.includes(t.id) &&
      pending.some(q => q.table_id === t.id && !q.done)
    )
  )
}

// ── Slots & Chanteurs ─────────────────────────────────────────────────────────

export function getSlotsForTable(table: Table, pending: QueueItem[]): number {
  if (table.is_solo) return 1
  const count = pending.filter(q => q.table_id === table.id && !q.done).length
  return count >= 4 ? 2 : 1
}

export function getNextSingers(table: Table, pending: QueueItem[], state: RotationState): QueueItem[] {
  const tp = pending
    .filter(q => q.table_id === table.id && !q.done)
    .sort((a, b) => {
      if (a.priority_order && b.priority_order) return a.priority_order - b.priority_order
      if (a.priority_order) return -1
      if (b.priority_order) return 1
      return new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime()
    })

  if (!tp.length) return []
  if (state.drainTableId === table.id || table.is_solo) return tp

  const slots = getSlotsForTable(table, pending)
  if (slots === 1) {
    const slot1 = tp.find(q => q.slot === 1)
    return [slot1 || tp[0]]
  }

  const slot1Singer = tp.find(q => q.slot === 1) || tp[0]
  const slot2Singer = tp.find(q => q.slot === 2 && q.id !== slot1Singer.id)
    || tp.find(q => q.id !== slot1Singer.id)
  return slot2Singer ? [slot1Singer, slot2Singer] : [slot1Singer]
}

// ── Ordre de rotation ─────────────────────────────────────────────────────────

export function getRotationOrder(tables: Table[], pending: QueueItem[], state: RotationState): Table[] {
  const active = getActiveTables(tables, pending, state.tablesDoneThisCycle, state.emptyPassed)
  if (!active.length && !state.priorityQueue?.length) return []

  if (state.drainTableId) {
    const drain = active.find(t => t.id === state.drainTableId)
    if (drain) return [drain, ...active.filter(t => t.id !== state.drainTableId)]
  }

  if (state.priorityQueue?.length) {
    const prioTables = state.priorityQueue
      .map(id =>
        active.find(t => t.id === id) ||
        tables.find(t =>
          t.id === id && !t.departed &&
          pending.some(q => q.table_id === t.id && !q.done)
        )
      )
      .filter(Boolean) as Table[]
    if (prioTables.length) {
      const prioIds = new Set(prioTables.map(t => t.id))
      const rest = active.filter(t => !prioIds.has(t.id))
      return [...prioTables, ...buildOrderedList(tables, rest, state.missedLastCycle)]
    }
  }

  return buildOrderedList(tables, active, state.missedLastCycle)
}

// Missed en tête, puis normaux — chacun dans l'ordre géographique (sort_order)
function buildOrderedList(tables: Table[], active: Table[], missed: string[]): Table[] {
  const sorted = geoSort(tables, active)
  if (!missed?.length) return sorted

  const missedTables  = sorted.filter(t => missed.includes(t.id))
  const normalTables  = sorted.filter(t => !missed.includes(t.id))
  return [...missedTables, ...normalTables]
}

// ── Avancement ────────────────────────────────────────────────────────────────

export interface AdvanceResult {
  newState:        RotationState
  tableId:         string
  tablesToUnblock: string[]
}

export function advanceRotation(
  tables: Table[],
  pending: QueueItem[],
  state: RotationState,
  doneTableId: string,
  isEmpty = false
): AdvanceResult {
  const tablesDone = isEmpty
    ? [...new Set([...state.tablesDoneThisCycle])]
    : [...new Set([...state.tablesDoneThisCycle, doneTableId])]

  const tablesDoneForRotation = [...new Set([...state.tablesDoneThisCycle, doneTableId])]

  const emptyPassed = isEmpty
    ? [...new Set([...(state.emptyPassed || []), doneTableId])]
    : (state.emptyPassed || [])

  const eligibleTables = tables.filter(
    t => !t.departed && (t.passages_before_entry ?? 0) === 0
      && pending.some(q => q.table_id === t.id && !q.done)
  )

  const allDone = eligibleTables.length > 0 && eligibleTables.every(t => tablesDoneForRotation.includes(t.id))
  const noMore  = getActiveTables(tables, pending.filter(q => q.table_id !== doneTableId), tablesDone, emptyPassed).length === 0
  const cycleComplete = allDone || noMore

  const tablesUnlockedNow = tables
    .filter(t => !t.departed && (t.passages_before_entry ?? 0) === 1)
    .map(t => t.id)

  let priorityQueue = (state.priorityQueue || []).filter(id => id !== doneTableId)
  if (!cycleComplete && tablesUnlockedNow.length > 0) {
    const geoSorted = sortClockwise(tables.filter(t => tablesUnlockedNow.includes(t.id))).map(t => t.id)
    priorityQueue = [...geoSorted.filter(id => !priorityQueue.includes(id)), ...priorityQueue]
  }

  let drainTableId = state.drainTableId
  if (state.drainTableId === doneTableId) {
    if (!pending.filter(q => q.table_id === doneTableId && !q.done).length) drainTableId = ''
  }

  const wasSOS = !!(state.sosReturnTableId && state.priorityQueue?.[0] === doneTableId)
  const nextCurrentTableId = wasSOS ? state.sosReturnTableId : doneTableId
  const nextTablesDone = cycleComplete ? [] : tablesDone

  const allNonDeparted = tables
    .filter(t => !t.departed && (t.passages_before_entry ?? 0) === 0)
    .map(t => t.id)
  const existingCycleStart = state.cycleStartTables || []
  const currentCycleStart = existingCycleStart.length > 0
    ? [...new Set([...existingCycleStart, ...emptyPassed])]
    : [...new Set([...allNonDeparted, doneTableId, ...emptyPassed])]

  const nextMissed = cycleComplete
    ? currentCycleStart.filter(id =>
        !tablesDone.includes(id) &&
        !tables.find(t => t.id === id)?.departed
      ).filter((id, i, arr) => arr.indexOf(id) === i)
    : (state.missedLastCycle || []).filter(id => !tables.find(t => t.id === id)?.departed)

  return {
    newState: {
      currentTableId:      nextCurrentTableId,
      cycleNumber:         cycleComplete ? state.cycleNumber + 1 : state.cycleNumber,
      tablesDoneThisCycle: nextTablesDone,
      priorityQueue,
      drainTableId,
      sosReturnTableId:    wasSOS ? '' : (state.sosReturnTableId || ''),
      lastCycleTableId:    cycleComplete ? doneTableId : (state.lastCycleTableId || ''),
      missedLastCycle:     nextMissed,
      cycleStartTables:    cycleComplete ? [] : currentCycleStart,
      emptyPassed:         cycleComplete ? [] : emptyPassed,
      sessionStartedAt:    state.sessionStartedAt || new Date().toISOString(),
    },
    tableId: doneTableId,
    tablesToUnblock: tables.filter(t => !t.departed && (t.passages_before_entry ?? 0) > 0).map(t => t.id),
  }
}

export function buildRotation(tables: Table[], pending: QueueItem[], state: RotationState): string[] {
  return getRotationOrder(tables, pending, state)
    .flatMap(t => getNextSingers(t, pending, state).map(s => s.id))
}

// ── Temps ──────────────────────────────────────────────────────────────────────

export function waitMin(q: QueueItem): number {
  return Math.floor((Date.now() - new Date(q.registered_at).getTime()) / 60000)
}

export function waitLabel(m: number): string {
  if (m < 1) return '<1min'
  if (m < 60) return `${m}min`
  return `${Math.floor(m / 60)}h${m % 60 ? (m % 60) + 'm' : ''}`
}

export function waitColor(m: number): string {
  if (m >= URGENT_MIN) return '#ef4444'
  if (m >= WARN_MIN)   return '#f59e0b'
  return '#6b7280'
}
