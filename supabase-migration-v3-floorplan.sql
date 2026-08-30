-- Position des tables sur le plan de salle (en pourcentage, 0-100)
alter table venue_tables add column if not exists x numeric not null default 50;
alter table venue_tables add column if not exists y numeric not null default 50;
