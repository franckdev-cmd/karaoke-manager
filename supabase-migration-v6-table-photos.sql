-- Photos prises par table (fonction "Photographier" / "Historique photos")
create table if not exists table_photos (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  table_id uuid not null references venue_tables(id) on delete cascade,
  data_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists table_photos_table_idx on table_photos(table_id);

alter table table_photos enable row level security;

create policy "owner reads own photos" on table_photos
  for select using (venue_id in (select id from venues where owner_id = auth.uid()));
create policy "owner writes own photos" on table_photos
  for all using (venue_id in (select id from venues where owner_id = auth.uid()))
  with check (venue_id in (select id from venues where owner_id = auth.uid()));
