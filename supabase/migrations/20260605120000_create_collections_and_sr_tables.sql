-- Collections table
create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_collections_user_id on collections(user_id);

alter table collections enable row level security;

create policy "Users can select their own collections"
  on collections for select
  using (user_id = auth.uid());

create policy "Users can insert their own collections"
  on collections for insert
  with check (user_id = auth.uid());

create policy "Users can update their own collections"
  on collections for update
  using (user_id = auth.uid());

create policy "Users can delete their own collections"
  on collections for delete
  using (user_id = auth.uid());

create trigger collections_set_updated_at
  before update on collections
  for each row
  execute function set_updated_at();

-- Add collection_id to flashcards
alter table flashcards
  add column collection_id uuid references collections(id) on delete set null;

create index idx_flashcards_collection_id on flashcards(collection_id);

-- Flashcard SR state table (1:1 with flashcards)
create table flashcard_sr_state (
  flashcard_id uuid primary key references flashcards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  difficulty float not null default 0,
  due timestamptz not null default now(),
  elapsed_days integer not null default 0,
  lapses integer not null default 0,
  last_review timestamptz,
  learning_steps integer not null default 0,
  reps integer not null default 0,
  scheduled_days integer not null default 0,
  stability float not null default 0,
  state smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_flashcard_sr_state_user_due on flashcard_sr_state(user_id, due);

alter table flashcard_sr_state enable row level security;

create policy "Users can select their own sr state"
  on flashcard_sr_state for select
  using (user_id = auth.uid());

create policy "Users can insert their own sr state"
  on flashcard_sr_state for insert
  with check (user_id = auth.uid());

create policy "Users can update their own sr state"
  on flashcard_sr_state for update
  using (user_id = auth.uid());

create policy "Users can delete their own sr state"
  on flashcard_sr_state for delete
  using (user_id = auth.uid());

create trigger flashcard_sr_state_set_updated_at
  before update on flashcard_sr_state
  for each row
  execute function set_updated_at();

-- Review logs table (append-only)
create table review_logs (
  id uuid primary key default gen_random_uuid(),
  flashcard_id uuid not null references flashcards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null,
  state smallint not null,
  difficulty float not null,
  stability float not null,
  due timestamptz not null,
  elapsed_days integer not null,
  last_elapsed_days integer not null,
  scheduled_days integer not null,
  learning_steps integer not null,
  review timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_review_logs_user_flashcard on review_logs(user_id, flashcard_id);

alter table review_logs enable row level security;

create policy "Users can select their own review logs"
  on review_logs for select
  using (user_id = auth.uid());

create policy "Users can insert their own review logs"
  on review_logs for insert
  with check (user_id = auth.uid());

-- Auto-create SR state on flashcard insert
create or replace function create_sr_state_on_flashcard_insert()
returns trigger as $$
begin
  insert into flashcard_sr_state (flashcard_id, user_id)
  values (NEW.id, NEW.user_id);
  return NEW;
end;
$$ language plpgsql;

create trigger flashcards_create_sr_state
  after insert on flashcards
  for each row
  execute function create_sr_state_on_flashcard_insert();
