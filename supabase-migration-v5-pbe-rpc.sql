-- Décrémente passages_before_entry d'une table (jamais en dessous de 0)
create or replace function decrement_passages_before_entry(table_id uuid)
returns void as $$
begin
  update venue_tables
  set passages_before_entry = greatest(0, passages_before_entry - 1)
  where id = table_id;
end;
$$ language plpgsql security definer;
