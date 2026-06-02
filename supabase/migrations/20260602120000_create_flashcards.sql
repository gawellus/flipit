create table flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_id uuid,
  front text not null,
  back text not null,
  source text not null default 'ai' check (source in ('ai', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_flashcards_user_id on flashcards(user_id);
create index idx_flashcards_generation_id on flashcards(generation_id);

alter table flashcards enable row level security;

create policy "Users can select their own flashcards"
  on flashcards for select
  using (user_id = auth.uid());

create policy "Users can insert their own flashcards"
  on flashcards for insert
  with check (user_id = auth.uid());

create policy "Users can update their own flashcards"
  on flashcards for update
  using (user_id = auth.uid());

create policy "Users can delete their own flashcards"
  on flashcards for delete
  using (user_id = auth.uid());
