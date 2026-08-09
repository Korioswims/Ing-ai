-- Ing cloud data: run this once in Supabase SQL Editor.
create table if not exists public.ing_chats (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.ing_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.ing_chats enable row level security;
alter table public.ing_memories enable row level security;

create policy "Users can view their own Ing chats" on public.ing_chats for select using (auth.uid() = user_id);
create policy "Users can insert their own Ing chats" on public.ing_chats for insert with check (auth.uid() = user_id);
create policy "Users can update their own Ing chats" on public.ing_chats for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own Ing chats" on public.ing_chats for delete using (auth.uid() = user_id);

create policy "Users can view their own Ing memories" on public.ing_memories for select using (auth.uid() = user_id);
create policy "Users can insert their own Ing memories" on public.ing_memories for insert with check (auth.uid() = user_id);
create policy "Users can update their own Ing memories" on public.ing_memories for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own Ing memories" on public.ing_memories for delete using (auth.uid() = user_id);

create index if not exists ing_chats_user_updated_idx on public.ing_chats(user_id, updated_at desc);
create index if not exists ing_memories_user_idx on public.ing_memories(user_id);
