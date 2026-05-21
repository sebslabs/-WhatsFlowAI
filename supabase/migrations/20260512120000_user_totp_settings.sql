-- Per-user TOTP settings (encrypted secret at rest; RLS restricts to owner)
create table if not exists public.user_totp_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  secret_ciphertext text not null,
  secret_iv text not null,
  secret_tag text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_totp_settings enable row level security;

create policy "user_totp_select_own" on public.user_totp_settings
  for select using (auth.uid() = user_id);

create policy "user_totp_insert_own" on public.user_totp_settings
  for insert with check (auth.uid() = user_id);

create policy "user_totp_update_own" on public.user_totp_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_totp_delete_own" on public.user_totp_settings
  for delete using (auth.uid() = user_id);
