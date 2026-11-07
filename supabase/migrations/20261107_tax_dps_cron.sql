-- Розклад синхронізації Електронного кабінету ДПС (кожні 15 хв).
-- Виконати ПІСЛЯ деплою функції tax-dps-sync і міграції 20261107_tax_dps_sync.sql.
-- Без підключеного токена функція лише позначає «ДПС: не підключено» і нічого не запитує в ДПС.
-- Заголовок несе публічний anon-ключ (як у решти задач A.U.R.A); примусову синхронізацію він не дає —
-- функція сама не ходить у ДПС частіше ніж раз на 5 хв.

select cron.schedule(
  'tax-dps-sync',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://rgfexlipniijwadwgmxf.supabase.co/functions/v1/tax-dps-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZmV4bGlwbmlpandhZHdnbXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjY0MjgsImV4cCI6MjA5NDg0MjQyOH0.DSsIX_Xao5kH0E_3d6xVZd8NjEqRtGp5GhF0_7u_Lv4"}'::jsonb,
    body := '{"action": "sync"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Telegram для сповіщень (той самий бот і чат, що й тривоги SETUP Stay: TG_BOT_TOKEN, ADMIN_TG_CHAT_ID).
-- Виконати вручну, підставивши значення (не комітити з реальними значеннями):
-- select vault.create_secret('<TG_BOT_TOKEN>', 'telegram_bot_token');
-- select vault.create_secret('<ADMIN_TG_CHAT_ID>', 'telegram_chat_id');
