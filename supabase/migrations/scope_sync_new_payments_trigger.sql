-- Виконати вручну в Supabase Dashboard → SQL Editor (проєкт "A.U.R.A findash", rgfexlipniijwadwgmxf)
-- Автоматичний режим Claude Code заблокував apply_migration для цього SQL (DB-тригер з вихідними
-- HTTP-викликами через net.http_post), тож застосовується вручну.
--
-- Що робить: коли findash_data.data змінюється, для кожного нового або зміненого НЕОПЛАЧЕНОГО
-- запису в debtors/creditors/returns шле POST на SCOPE (/api/integrations/payments) з x-api-key.
-- URL і ключ SCOPE читаються з Supabase Vault (scope_payments_url, scope_api_key) — поки що це
-- плейсхолдери 'PENDING_FROM_SCOPE', тригер тихо нічого не робить, доки їх не оновити:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'scope_payments_url'),
--     'https://...реальний URL SCOPE.../api/integrations/payments'
--   );
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'scope_api_key'),
--     'реальний INTEGRATIONS_API_KEY від SCOPE'
--   );

create or replace function public.sync_new_payments_to_scope()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_url text;
  v_key text;
  arr_name text;
  new_arr jsonb;
  old_arr jsonb;
  el jsonb;
  old_el jsonb;
  ext_ref text;
  title_prefix text;
begin
  if NEW.id <> 'main' then
    return NEW;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'scope_payments_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'scope_api_key';

  if v_url is null or v_url = '' or v_url = 'PENDING_FROM_SCOPE' then
    return NEW;
  end if;

  foreach arr_name in array array['debtors','creditors','returns'] loop
    new_arr := coalesce(NEW.data -> arr_name, '[]'::jsonb);
    old_arr := coalesce(OLD.data -> arr_name, '[]'::jsonb);

    title_prefix := case arr_name
      when 'creditors' then 'Виплата'
      when 'returns'   then 'Повернення клієнту'
      else 'Очікується надходження'
    end;

    for el in select value from jsonb_array_elements(new_arr) loop
      if (el->>'paid')::boolean is true then
        continue;
      end if;

      -- SCOPE трактує due_date як дедлайн задачі; без дати не шлемо, щоб не створювати
      -- фальшиво-термінові задачі "на сьогодні" для платежів без призначеної дати.
      if coalesce(el->>'due','') = '' then
        continue;
      end if;

      old_el := null;
      select value into old_el
      from jsonb_array_elements(old_arr)
      where (value->>'id') = (el->>'id')
      limit 1;

      if old_el is null
         or (old_el->>'name')   is distinct from (el->>'name')
         or (old_el->>'amount') is distinct from (el->>'amount')
         or (old_el->>'due')    is distinct from (el->>'due')
         or (old_el->>'note')   is distinct from (el->>'note')
      then
        ext_ref := arr_name || '_' || (el->>'id');
        perform net.http_post(
          url := v_url,
          headers := jsonb_build_object('Content-Type','application/json','x-api-key', v_key),
          body := jsonb_build_object(
            'external_ref', ext_ref,
            'title', title_prefix || ': ' || coalesce(el->>'name',''),
            'due_date', nullif(el->>'due',''),
            'amount', (el->>'amount')::numeric,
            'counterparty', el->>'name',
            'description', el->>'note',
            'priority', 'high',
            'external_source', 'financial-analytics'
          ),
          timeout_milliseconds := 8000
        );
      end if;
    end loop;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_payments_to_scope on public.findash_data;
create trigger trg_sync_payments_to_scope
after update on public.findash_data
for each row
when (OLD.data is distinct from NEW.data)
execute function public.sync_new_payments_to_scope();
