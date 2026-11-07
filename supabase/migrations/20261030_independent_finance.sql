-- Additive module: no updates to legacy JSON, bank records, plans or formulas.
BEGIN;
CREATE TABLE public.aura_finance_settings (
 id text PRIMARY KEY DEFAULT 'main' CHECK(id='main'),
 refund_cutoff date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Kyiv')::date - 45),
 launched_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Kyiv')::date)
);
CREATE TABLE public.aura_finance_costs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(trim(name))>0),
 category text NOT NULL DEFAULT 'other', amount numeric(14,2) NOT NULL CHECK(amount>0),
 currency text NOT NULL DEFAULT 'UAH' CHECK(currency IN ('UAH','USD','EUR','PLN')),
 fx_rate numeric(14,6) CHECK(fx_rate>0),
 frequency text NOT NULL DEFAULT 'monthly' CHECK(frequency IN ('once','monthly','yearly')),
 start_date date NOT NULL, end_date date CHECK(end_date>=start_date),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.aura_finance_refunds (
 id text PRIMARY KEY, name text NOT NULL, amount numeric(14,2) NOT NULL CHECK(amount>=0),
 amount_override numeric(14,2) CHECK(amount_override>=0), entered_on date,
 date_source text NOT NULL DEFAULT 'unknown' CHECK(date_source IN ('unknown','observed','confirmed')),
 excluded boolean NOT NULL DEFAULT false, paid boolean NOT NULL DEFAULT false,
 observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.aura_finance_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bank_id text NOT NULL UNIQUE REFERENCES public.bank_transactions(id),
 kind text NOT NULL CHECK(kind IN ('expense','exclude','cost','refund','legacy')),
 cost_id uuid REFERENCES public.aura_finance_costs(id), refund_id text REFERENCES public.aura_finance_refunds(id),
 legacy_id text, coverage_month date,
 CHECK ((kind='cost' AND cost_id IS NOT NULL AND coverage_month IS NOT NULL AND refund_id IS NULL AND legacy_id IS NULL)
 OR (kind='refund' AND refund_id IS NOT NULL AND cost_id IS NULL AND legacy_id IS NULL)
 OR (kind='legacy' AND legacy_id IS NOT NULL AND cost_id IS NULL AND refund_id IS NULL)
 OR (kind IN ('expense','exclude') AND cost_id IS NULL AND refund_id IS NULL AND legacy_id IS NULL))
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['aura_finance_settings','aura_finance_costs','aura_finance_refunds','aura_finance_links'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY owner_access ON public.%I FOR ALL TO authenticated USING ((auth.jwt()->>''email'') = ''wuwchik1@gmail.com'') WITH CHECK ((auth.jwt()->>''email'') = ''wuwchik1@gmail.com'')',t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon',t);
 END LOOP;
END $$;
INSERT INTO public.aura_finance_settings(id) VALUES('main');
INSERT INTO public.aura_finance_costs(name,category,amount,currency,frequency,start_date) VALUES
 ('Штучний інтелект','ai',45,'USD','monthly',date_trunc('month',now() AT TIME ZONE 'Europe/Kyiv')::date),
 ('Easy MS','software',4000,'UAH','monthly',date_trunc('month',now() AT TIME ZONE 'Europe/Kyiv')::date),
 ('Supabase','software',25,'USD','monthly',date_trunc('month',now() AT TIME ZONE 'Europe/Kyiv')::date),
 ('Vercel','hosting',20,'USD','monthly',date_trunc('month',now() AT TIME ZONE 'Europe/Kyiv')::date);
INSERT INTO public.aura_finance_refunds(id,name,amount,paid)
 SELECT r->>'id',coalesce(r->>'name','Повернення'),greatest(coalesce((r->>'amount')::numeric,0),0),coalesce((r->>'paid')::boolean,false)
 FROM public.findash_data f CROSS JOIN LATERAL jsonb_array_elements(coalesce(f.data->'returns','[]')) r
 WHERE f.id='main';
CREATE FUNCTION public.aura_capture_finance_returns() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb;
BEGIN
 FOR r IN SELECT value FROM jsonb_array_elements(coalesce(NEW.data->'returns','[]')) LOOP
  INSERT INTO public.aura_finance_refunds(id,name,amount,paid,entered_on,date_source)
  VALUES(r->>'id',coalesce(r->>'name','Повернення'),greatest(coalesce((r->>'amount')::numeric,0),0),coalesce((r->>'paid')::boolean,false),(now() AT TIME ZONE 'Europe/Kyiv')::date,'observed')
  ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,amount=EXCLUDED.amount,paid=EXCLUDED.paid;
 END LOOP;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN
 RAISE WARNING 'AURA finance return capture failed: %',SQLERRM;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.aura_capture_finance_returns() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER aura_capture_finance_returns AFTER UPDATE OF data ON public.findash_data
 FOR EACH ROW WHEN (NEW.id='main' AND (OLD.data->'returns') IS DISTINCT FROM (NEW.data->'returns'))
 EXECUTE FUNCTION public.aura_capture_finance_returns();
COMMIT;
