-- New independent tax module; does not alter existing financial tables.
-- Never store KEP files, KEP passwords, taxpayer IDs or DПС authorization headers here.
create table if not exists public.aura_tax_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tax_regime text not null default 'fop3_5' check (tax_regime = 'fop3_5'),
  esv_exempt boolean not null default false,
  income_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(income_overrides) = 'object'),
  manual_status jsonb not null default '{}'::jsonb check (jsonb_typeof(manual_status) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.aura_tax_settings enable row level security;
create policy "Tax settings readable by owner"
  on public.aura_tax_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Tax settings insertable by owner"
  on public.aura_tax_settings for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Tax settings editable by owner"
  on public.aura_tax_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on public.aura_tax_settings from anon;
grant select, insert, update on public.aura_tax_settings to authenticated;
