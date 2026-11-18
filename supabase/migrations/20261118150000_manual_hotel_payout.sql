-- Ручна виплата закладу (рішення власника 18.11.2026): виплату зроблено не з рахунку ФОП (готівка, інша картка) —
-- банківського списання немає, але борг закладу треба закрити. Банківські виплати — без змін.
-- source: 'aura' — кнопка «Оплачено» в A.U.R.A; 'crm' — кнопка «Виплачено» в календарі SETUP Stay.
-- external_ref — ключ повтору з CRM (одна подія календаря — одна виплата).
alter table public.aura_hotel_payouts alter column bank_id drop not null;
alter table public.aura_hotel_payouts
  add column if not exists method text not null default 'bank' check (method in ('bank','manual')),
  add column if not exists paid_on date,
  add column if not exists note text check (note is null or length(note) <= 300),
  add column if not exists source text not null default 'aura' check (source in ('aura','crm')),
  add column if not exists external_ref text unique;
alter table public.aura_hotel_payouts add constraint aura_hotel_payouts_method_bank
  check ((method = 'bank') = (bank_id is not null));

create or replace function public.aura_validate_hotel_payout() returns trigger language plpgsql security invoker set search_path='' as $$
declare s public.aura_payment_splits; b public.bank_transactions; paid numeric; sid uuid;
begin
 sid:=case when TG_OP='DELETE' then old.split_id else new.split_id end;
 -- All writes for an income serialize on its bank row, including first split creation.
 perform 1 from public.bank_transactions where id=(select bank_id from public.aura_payment_splits where id=sid) for update;
 select * into s from public.aura_payment_splits where id=sid;
 if not found then raise exception 'Розподіл не знайдено'; end if;
 if TG_OP='DELETE' then return old; end if;
 select coalesce(sum(amount),0) into paid from public.aura_hotel_payouts where split_id=s.id;
 if new.method='manual' then
   if new.bank_id is not null then raise exception 'Ручна виплата — без банківського списання'; end if;
   if new.amount is null or new.amount<=0 then raise exception 'Вкажіть суму виплати'; end if;
   new.amount:=round(new.amount,2);
   if paid+new.amount>s.hotel_amount then raise exception 'Платіж перевищує залишок боргу'; end if;
   new.paid_on:=coalesce(new.paid_on,(now() at time zone 'Europe/Kyiv')::date);
   return new;
 end if;
 select * into b from public.bank_transactions where id=new.bank_id for update;
 if not found or b.type<>'expense' or b.amount<=0 then raise exception 'Оберіть банківське списання'; end if;
 if exists(select 1 from public.aura_finance_links where bank_id=new.bank_id) then raise exception 'Цей платіж вже врахований у витратах. Спочатку скасуйте попередній зв’язок'; end if;
 if paid+b.amount>s.hotel_amount then raise exception 'Платіж перевищує залишок боргу'; end if;
 new.amount:=b.amount; return new;
end $$;
revoke all on function public.aura_validate_hotel_payout() from public,anon,authenticated;
