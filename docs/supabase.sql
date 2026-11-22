-- Comptes String Coach : une ligne par utilisateur, lisible et modifiable par lui seul.
-- À coller dans Supabase › SQL Editor › New query, puis « Run ».
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "lire son profil" on public.profiles;
drop policy if exists "créer son profil" on public.profiles;
drop policy if exists "modifier son profil" on public.profiles;

create policy "lire son profil" on public.profiles
  for select using (auth.uid() = user_id);
create policy "créer son profil" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "modifier son profil" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
