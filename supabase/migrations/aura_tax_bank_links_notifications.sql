-- Separate settings for detected bank-tax payments and opt-in desktop notifications.
-- These contain NO KEP, password, raw DPS credential or signed Authorization.
alter table public.aura_tax_settings
  add column if not exists bank_links jsonb not null default '{}'::jsonb,
  add column if not exists notifications_enabled boolean not null default false;
alter table public.aura_tax_settings
  add constraint aura_tax_settings_bank_links_object check (jsonb_typeof(bank_links) = 'object');
