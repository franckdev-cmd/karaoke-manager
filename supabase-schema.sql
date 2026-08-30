-- Un "venue" = un établissement = un compte Google connecté
create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Mon établissement',
  mode text check (mode in ('singers', 'tables')),
  singers_qr_code text,               -- code unique généré si mode = 'singers'
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists venues_owner_id_idx on venues(owner_id);

-- Salles (uniquement en mode "tables")
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Tables, rattachées à une salle
create table if not exists venue_tables (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null,
  pax int not null default 4,
  code text unique,                   -- code 4 caractères, même logique que nyc-karaoke
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table venues enable row level security;
alter table rooms enable row level security;
alter table venue_tables enable row level security;

-- Chaque utilisateur ne voit / modifie que son propre venue
create policy "owner reads own venue" on venues
  for select using (auth.uid() = owner_id);
create policy "owner inserts own venue" on venues
  for insert with check (auth.uid() = owner_id);
create policy "owner updates own venue" on venues
  for update using (auth.uid() = owner_id);

create policy "owner reads own rooms" on rooms
  for select using (venue_id in (select id from venues where owner_id = auth.uid()));
create policy "owner writes own rooms" on rooms
  for all using (venue_id in (select id from venues where owner_id = auth.uid()))
  with check (venue_id in (select id from venues where owner_id = auth.uid()));

create policy "owner reads own tables" on venue_tables
  for select using (venue_id in (select id from venues where owner_id = auth.uid()));
create policy "owner writes own tables" on venue_tables
  for all using (venue_id in (select id from venues where owner_id = auth.uid()))
  with check (venue_id in (select id from venues where owner_id = auth.uid()));
