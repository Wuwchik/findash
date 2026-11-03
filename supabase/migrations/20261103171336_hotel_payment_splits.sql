-- Isolated AURA ledger. No writes to findash_data, CRM, SCOPE or network calls.
create table public.aura_payment_splits (
 id uuid primary key default gen_random_uuid(),
 bank_id text not null unique references public.bank_transactions(id),
 hotel text not null check (length(trim(hotel))>0),
 hotel_amount numeric(14,2) not null check (hotel_amount>=0),
 due date,
 crm_deal_id text,
 updated_at timestamptz not null default now()
);
create table public.aura_hotel_payouts (
 id uuid primary key default gen_random_uuid(),
 split_id uuid not null references public.aura_payment_splits(id),
 bank_id text not null unique references public.bank_transactions(id),
 amount numeric(14,2) not null check (amount>0),
 created_at timestamptz not null default now()
);
create index aura_hotel_payouts_split_idx on public.aura_hotel_payouts(split_id);
alter table public.aura_payment_splits enable row level security;
alter table public.aura_hotel_payouts enable row level security;
revoke all on public.aura_payment_splits, public.aura_hotel_payouts from anon, authenticated;
grant select,insert,update on public.aura_payment_splits to authenticated;
grant select,insert,delete on public.aura_hotel_payouts to authenticated;
create policy owner_access on public.aura_payment_splits to authenticated
 using ((select auth.jwt()->>'email')='wuwchik1@gmail.com')
 with check ((select auth.jwt()->>'email')='wuwchik1@gmail.com');
create policy owner_access on public.aura_hotel_payouts to authenticated
 using ((select auth.jwt()->>'email')='wuwchik1@gmail.com')
 with check ((select auth.jwt()->>'email')='wuwchik1@gmail.com');

create function public.aura_validate_split() returns trigger language plpgsql security invoker set search_path='' as $$
declare b public.bank_transactions; paid numeric;
begin
 if TG_OP='UPDATE' and (new.id<>old.id or new.bank_id<>old.bank_id) then raise exception 'Джерело розподілу змінювати не можна'; end if;
 select * into b from public.bank_transactions where id=new.bank_id for update;
 if not found or b.type<>'income' or new.hotel_amount>b.amount then raise exception 'Частка закладу має бути в межах надходження'; end if;
 select coalesce(sum(amount),0) into paid from public.aura_hotel_payouts where split_id=new.id;
 if new.hotel_amount<paid then raise exception 'Сума менша за вже виплачену. Спочатку скасуйте помилкові прив’язки виплат'; end if;
 if TG_OP='UPDATE' and paid>0 and new.hotel<>old.hotel then raise exception 'Не можна змінювати заклад після виплати'; end if;
 new.updated_at:=clock_timestamp(); return new;
end $$;
create trigger validate_split before insert or update on public.aura_payment_splits for each row execute function public.aura_validate_split();

create function public.aura_validate_hotel_payout() returns trigger language plpgsql security invoker set search_path='' as $$
declare s public.aura_payment_splits; b public.bank_transactions; paid numeric; sid uuid;
begin
 sid:=case when TG_OP='DELETE' then old.split_id else new.split_id end;
 -- All writes for an income serialize on its bank row, including first split creation.
 perform 1 from public.bank_transactions where id=(select bank_id from public.aura_payment_splits where id=sid) for update;
 select * into s from public.aura_payment_splits where id=sid;
 if not found then raise exception 'Розподіл не знайдено'; end if;
 if TG_OP='DELETE' then return old; end if;
 select * into b from public.bank_transactions where id=new.bank_id for update;
 if not found or b.type<>'expense' or b.amount<=0 then raise exception 'Оберіть банківське списання'; end if;
 if exists(select 1 from public.aura_finance_links where bank_id=new.bank_id) then raise exception 'Цей платіж вже врахований у витратах. Спочатку скасуйте попередній зв’язок'; end if;
 select coalesce(sum(amount),0) into paid from public.aura_hotel_payouts where split_id=s.id;
 if paid+b.amount>s.hotel_amount then raise exception 'Платіж перевищує залишок боргу'; end if;
 new.amount:=b.amount; return new;
end $$;
create trigger validate_hotel_payout before insert or delete on public.aura_hotel_payouts for each row execute function public.aura_validate_hotel_payout();
create function public.aura_guard_payout_link() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.bank_transactions where id=new.bank_id for update;
 if exists(select 1 from public.aura_hotel_payouts where bank_id=new.bank_id) then raise exception 'Це виплата закладу: повторно враховувати її у витратах не можна'; end if;
 return new;
end $$;
create trigger guard_hotel_payout_link before insert or update on public.aura_finance_links for each row execute function public.aura_guard_payout_link();
revoke all on function public.aura_validate_split(),public.aura_validate_hotel_payout(),public.aura_guard_payout_link() from public,anon,authenticated;

-- Read-only future integration contract. No dispatcher, webhook or CRM writes.
create view public.aura_hotel_debt_export with (security_invoker=true) as
 select s.id, 'aura:hotel-debt:'||s.id::text as external_ref,s.bank_id,s.hotel,s.crm_deal_id,s.due,
 s.hotel_amount as total_amount,coalesce(p.paid,0) as paid_amount,
 s.hotel_amount-coalesce(p.paid,0) as outstanding_amount,
 case when s.hotel_amount=0 then 'cancelled' when coalesce(p.paid,0)=s.hotel_amount then 'paid' when coalesce(p.paid,0)>0 then 'partial' else 'pending' end as status,
 greatest(s.updated_at,coalesce(p.last_payment,s.updated_at)) as updated_at,
 false as crm_sync_enabled
 from public.aura_payment_splits s left join (select split_id,sum(amount) paid,max(created_at) last_payment from public.aura_hotel_payouts group by split_id) p on p.split_id=s.id;
revoke all on public.aura_hotel_debt_export from anon,authenticated;
grant select on public.aura_hotel_debt_export to authenticated;
