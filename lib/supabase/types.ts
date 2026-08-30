export type VenueMode = 'singers' | 'tables'

export type Venue = {
  id: string
  owner_id: string
  name: string
  mode: VenueMode | null
  singers_qr_code: string | null
  onboarding_done: boolean
  created_at: string
}

export type Room = {
  id: string
  venue_id: string
  name: string
  sort_order: number
  created_at: string
}

export type VenueTable = {
  id: string
  venue_id: string
  room_id: string
  name: string
  pax: number
  code: string | null
  sort_order: number
  x: number
  y: number
  departed: boolean
  is_solo: boolean
  free_mode: boolean
  free_mode_max: number
  passages_before_entry: number
  created_at: string
}

export type QueueItemDB = {
  id: string
  venue_id: string
  table_id: string
  singer: string
  song: string
  artist: string
  key: string
  youtube_link: string
  sing_count: number
  done: boolean
  slot: number | null
  priority_order: number | null
  device_id: string | null
  linked_singer: string | null
  registered_at: string
}

export type TablePhoto = {
  id: string
  venue_id: string
  table_id: string
  data_url: string
  created_at: string
}

export type RotationStateDB = {
  venue_id: string
  current_table_id: string | null
  cycle_number: number
  tables_done_this_cycle: string[]
  priority_queue: string[]
  drain_table_id: string | null
  sos_return_table_id: string | null
  last_cycle_table_id: string | null
  missed_last_cycle: string[]
  cycle_start_tables: string[]
  empty_passed: string[]
  session_started_at: string
  updated_at: string
}
