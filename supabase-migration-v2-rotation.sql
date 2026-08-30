-- Colonnes manquantes sur venue_tables pour la rotation
alter table venue_tables add column if not exists departed boolean not null default false;
alter table venue_tables add column if not exists is_solo boolean not null default false;
alter table venue_tables add column if not exists passages_before_entry int not null default 0;

-- File d'attente des chanteurs, par table
create table if not exists queue_items (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  table_id uuid not null references venue_tables(id) on delete cascade,
  singer text not null,
  song text not null,
  artist text default '',
  key text default '',
  youtube_link text default '',
  sing_count int not null default 0,
  done boolean not null default false,
  slot int,
  priority_order int,
  device_id text,
  linked_singer text,
  registered_at timestamptz not null default now()
);

create index if not exists queue_items_venue_idx on queue_items(venue_id);
create index if not exists queue_items_table_idx on queue_items(table_id);

-- État de rotation, un par établissement
create table if not exists rotation_state (
  venue_id uuid primary key references venues(id) on delete cascade,
  current_table_id uuid,
  cycle_number int not null default 1,
  tables_done_this_cycle uuid[] not null default '{}',
  priority_queue uuid[] not null default '{}',
  drain_table_id uuid,
  sos_return_table_id uuid,
  last_cycle_table_id uuid,
  missed_last_cycle uuid[] not null default '{}',
  cycle_start_tables uuid[] not null default '{}',
  empty_passed uuid[] not null default '{}',
  session_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table queue_items enable row level security;
alter table rotation_state enable row level security;

create policy "owner reads own queue" on queue_items
  for select using (venue_id in (select id from venues where owner_id = auth.uid()));
create policy "owner writes own queue" on queue_items
  for all using (venue_id in (select id from venues where owner_id = auth.uid()))
  with check (venue_id in (select id from venues where owner_id = auth.uid()));

create policy "owner reads own rotation" on rotation_state
  for select using (venue_id in (select id from venues where owner_id = auth.uid()));
create policy "owner writes own rotation" on rotation_state
  for all using (venue_id in (select id from venues where owner_id = auth.uid()))
  with check (venue_id in (select id from venues where owner_id = auth.uid()));

-- Le public (clients qui scannent un QR/code) doit pouvoir s'inscrire dans la file
-- sans être connecté au compte du gérant. On ouvre l'insertion à tout le monde,
-- mais uniquement sur des tables existantes (le code d'accès filtre déjà en amont
-- côté application).
create policy "public can register in queue" on queue_items
  for insert with check (true);
create policy "public can read own venue queue for display" on queue_items
  for select using (true);
