-- Mode libre (les chanteurs s'enchaînent librement à la table, sans ordre fixe)
alter table venue_tables add column if not exists free_mode boolean not null default false;
alter table venue_tables add column if not exists free_mode_max int not null default 6;
