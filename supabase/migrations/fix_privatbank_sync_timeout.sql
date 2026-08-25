-- Виконати вручну в Supabase Dashboard → SQL Editor (проєкт "A.U.R.A findash", rgfexlipniijwadwgmxf)
-- Заблоковано для автоматичного застосування (класифікатор блокує SQL з anon-ключем у тексті).
--
-- Проблема: cron-задача "privatbank-sync-every-5min" (jobid 1) викликає dynamic-handler
-- без явного timeout_milliseconds, тож net.http_post чекає лише дефолтні 5000мс. Сама функція
-- реально виконується ~15-20с і щоразу успішно завершується (200 в логах функції) — pg_net
-- просто перестає чекати раніше й хибно логує це як таймаут у net._http_response. Дані
-- синхронізуються коректно, це суто шумний хибний запис у логах. Піднімаємо таймаут до 30с,
-- щоб pg_net дочекався реальної відповіді.

select cron.alter_job(
  job_id := 1,
  command := $$
  select net.http_post(
    url := 'https://rgfexlipniijwadwgmxf.supabase.co/functions/v1/dynamic-handler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZmV4bGlwbmlpandhZHdnbXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjY0MjgsImV4cCI6MjA5NDg0MjQyOH0.DSsIX_Xao5kH0E_3d6xVZd8NjEqRtGp5GhF0_7u_Lv4"}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);
