-- Дані Електронного кабінету ДПС для вкладки «Податки» (рішення власника 07.11.2026).
-- Пише лише Edge Function tax-dps-sync (service_role). Власник читає; позначає листи прочитаними.
-- Підписаний токен ДПС (Authorization) зберігається ТІЛЬКИ у Vault як секрет dps_auth_token.
-- Це підписаний РНОКПП: дає читання податкових даних, але не дає права підписувати чи подавати документи.
-- Файл КЕП і пароль ніде не зберігаються.

create table if not exists public.aura_tax_dps_state (
  id text primary key default 'main' check (id = 'main'),
  token_status text not null default 'missing' check (token_status in ('missing', 'ok', 'rejected', 'error')),
  payer_name text,
  last_attempt_at timestamptz,
  last_ok_at timestamptz,
  last_error text,
  reports_synced_at timestamptz,
  alerted_status text,                 -- щоб тривога «токен відхилено» ішла в Telegram один раз
  updated_at timestamptz not null default now()
);
insert into public.aura_tax_dps_state (id) values ('main') on conflict do nothing;

-- Стан розрахунків з бюджетом (ta/splatp): один рядок на особовий рахунок за рік
create table if not exists public.aura_tax_dps_accounts (
  id text primary key,                 -- {year}:{idpmnt}
  year int not null,
  idpmnt text not null,
  csti int,
  sti_name text,
  budget_code text,                    -- plat1, напр. "18050400"
  name text,                           -- namePlt, напр. "Єдиний податок з фізичних осіб"
  accrued numeric(14,2),               -- narah0
  paid numeric(14,2),                  -- splbd0
  refunded numeric(14,2),              -- povbd0
  penalty numeric(14,2),               -- penia0
  arrears numeric(14,2),               -- nedoim0
  overpaid numeric(14,2),              -- perepl0
  penalty_balance numeric(14,2),       -- sldpn0
  balance numeric(14,2),               -- debtAll
  iban text,                           -- budgetAccountIban — реквізити для сплати
  recipient_code text,                 -- budgetTin
  recipient_name text,                 -- budgetPayerName
  bank_name text,
  updated_at timestamptz not null default now()
);

-- Операції по рахунку (ta/splatp/.../pa): нарахування, сплати, пеня
create table if not exists public.aura_tax_dps_operations (
  id text primary key,                 -- {account_id}:{rn}
  account_id text not null references public.aura_tax_dps_accounts on delete cascade,
  op_date date,
  code text,
  name text,
  amount numeric(14,2),
  accrued numeric(14,2),
  paid numeric(14,2),
  comment text,
  first_seen_at timestamptz not null default now()
);
create index if not exists aura_tax_dps_operations_account_idx on public.aura_tax_dps_operations (account_id, op_date desc);

-- Вхідна кореспонденція від ДПС (post/incoming): листи, квитанції, повідомлення
create table if not exists public.aura_tax_dps_letters (
  id text primary key,                 -- id документа ДПС
  year int,
  cdoc text,
  name text,
  date_in timestamptz,
  read_in_dps boolean,
  status int,
  first_seen_at timestamptz not null default now(),
  notified_at timestamptz,
  seen_at timestamptz                  -- відкрито в A.U.R.A
);
create index if not exists aura_tax_dps_letters_date_idx on public.aura_tax_dps_letters (date_in desc);

-- Подана звітність (reg_doc/list) зі статусом обробки
create table if not exists public.aura_tax_dps_reports (
  id text primary key,                 -- codRegdoc
  ref_id text,
  year int,
  period_year int,
  period_month int,
  period_type int,
  period text,
  code text,
  name text,
  status text,
  received_at timestamptz,
  due_at timestamptz,
  reg_number text,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['aura_tax_dps_state','aura_tax_dps_accounts','aura_tax_dps_operations','aura_tax_dps_letters','aura_tax_dps_reports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('drop policy if exists owner_read on public.%I', t);
    execute format($p$create policy owner_read on public.%I for select to authenticated
      using ((select auth.jwt() ->> 'email') = 'wuwchik1@gmail.com')$p$, t);
  end loop;
end $$;

-- Власник позначає лист прочитаним (лише поле seen_at)
grant update (seen_at) on public.aura_tax_dps_letters to authenticated;
drop policy if exists owner_mark_seen on public.aura_tax_dps_letters;
create policy owner_mark_seen on public.aura_tax_dps_letters for update to authenticated
  using ((select auth.jwt() ->> 'email') = 'wuwchik1@gmail.com')
  with check ((select auth.jwt() ->> 'email') = 'wuwchik1@gmail.com');

-- Запис токена ДПС у Vault — лише з Edge Function (service_role), лише цей один секрет
create or replace function public.aura_set_dps_token(token text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare sid uuid;
begin
  select id into sid from vault.secrets where name = 'dps_auth_token';
  if token is null or length(token) = 0 then
    if sid is not null then delete from vault.secrets where id = sid; end if;
    return;
  end if;
  if sid is null then
    perform vault.create_secret(token, 'dps_auth_token', 'ДПС: підписаний РНОКПП для API Електронного кабінету (лише читання)');
  else
    perform vault.update_secret(sid, token);
  end if;
end $$;
revoke all on function public.aura_set_dps_token(text) from public, anon, authenticated;
grant execute on function public.aura_set_dps_token(text) to service_role;
