-- Transactional fixtures only. Everything is rolled back; no CRM/network calls.
begin;
insert into public.bank_transactions(id,date,amount,type) values
 ('__aura_split_test_in',now(),15000,'income'),
 ('__aura_split_test_out1',now(),6000,'expense'),
 ('__aura_split_test_out2',now(),4000,'expense'),
 ('__aura_split_test_over',now(),5000,'expense');
set local role authenticated;
select set_config('request.jwt.claims','{"email":"wuwchik1@gmail.com","role":"authenticated"}',true);
do $$
declare sid uuid; n numeric; failed boolean;
begin
 insert into public.aura_payment_splits(bank_id,hotel,hotel_amount) values ('__aura_split_test_in','Test hotel',10000) returning id into sid;
 insert into public.aura_hotel_payouts(split_id,bank_id,amount) values(sid,'__aura_split_test_out1',1);
 select outstanding_amount into n from public.aura_hotel_debt_export where id=sid;
 if n<>4000 then raise exception 'Partial payout failed: %',n; end if;
 failed:=false;
 begin insert into public.aura_hotel_payouts(split_id,bank_id,amount) values(sid,'__aura_split_test_over',1); exception when others then failed:=true; end;
 if not failed then raise exception 'Overpayment accepted'; end if;
 failed:=false;
 begin update public.aura_payment_splits set hotel_amount=5000 where id=sid; exception when others then failed:=true; end;
 if not failed then raise exception 'Split below paid accepted'; end if;
 failed:=false;
 begin insert into public.aura_finance_links(bank_id,kind) values('__aura_split_test_out1','expense'); exception when others then failed:=true; end;
 if not failed then raise exception 'Double expense accepted'; end if;
 insert into public.aura_finance_links(bank_id,kind) values('__aura_split_test_out2','expense');
 failed:=false;
 begin insert into public.aura_hotel_payouts(split_id,bank_id,amount) values(sid,'__aura_split_test_out2',1); exception when others then failed:=true; end;
 if not failed then raise exception 'Previously classified payout accepted'; end if;
 delete from public.aura_finance_links where bank_id='__aura_split_test_out2';
 insert into public.aura_hotel_payouts(split_id,bank_id,amount) values(sid,'__aura_split_test_out2',1);
 select outstanding_amount into n from public.aura_hotel_debt_export where id=sid;
 if n<>0 then raise exception 'Full payout failed'; end if;
 delete from public.aura_hotel_payouts where split_id=sid;
 update public.aura_payment_splits set hotel_amount=0 where id=sid;
 if not exists(select 1 from public.aura_hotel_debt_export where id=sid and status='cancelled' and crm_sync_enabled=false) then raise exception 'Cancellation/export failed'; end if;
 failed:=false;
 begin update public.aura_payment_splits set hotel_amount=15001 where id=sid; exception when others then failed:=true; end;
 if not failed then raise exception 'Oversized split accepted'; end if;
end $$;
select set_config('request.jwt.claims','{"email":"another@example.com","role":"authenticated"}',true);
do $$
declare failed boolean:=false;
begin
 if exists(select 1 from public.aura_payment_splits where bank_id='__aura_split_test_in') then raise exception 'RLS leaked split'; end if;
 if exists(select 1 from public.aura_hotel_debt_export where bank_id='__aura_split_test_in') then raise exception 'RLS leaked export'; end if;
 begin insert into public.aura_payment_splits(bank_id,hotel,hotel_amount) values('__aura_split_test_in','Other',1); exception when others then failed:=true; end;
 if not failed then raise exception 'RLS allowed write'; end if;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','public.aura_hotel_debt_export','SELECT') or has_table_privilege('anon','public.aura_payment_splits','SELECT') or has_table_privilege('authenticated','public.aura_hotel_payouts','UPDATE') then raise exception 'Unexpected grants'; end if;
end $$;
rollback;
