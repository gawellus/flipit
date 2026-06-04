create or replace function set_updated_at()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

create trigger flashcards_set_updated_at
  before update on flashcards
  for each row
  execute function set_updated_at();
