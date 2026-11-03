# Окремий фінансовий розрахунок AURA

Наявні Dashboard, Analytics, Returns, storage та їхні формули не змінені.
Новий модуль додається нижче всього дашборда. У «Повернення» додано вкладку
«Витрати», а також окреме уточнення повернень для нового розрахунку.

## Розрахунок

- Календарний день/тиждень (з понеділка)/місяць/квартал/рік до вибраної дати
  включно, час Europe/Kyiv. Доходи — тільки банківські надходження, без
  повторного додавання їхніх копій із data.transactions.
- Банківські дані завантажуються з пагінацією; старий завантажувач не змінено.
- Повернення віднімається один раз за entered_on. Оплата повернення не є
  додатковою витратою, якщо пов'язана з поверненням у новому модулі.
- Фіксований cutoff = дата встановлення міграції мінус 45 календарних днів.
  Старі записи не видаляються. Невідома дата не замінюється due/paidAt.
- Існуючі повернення імпортуються без дати й потребують уточнення за CRM.
  Нові записи отримують дату першого спостереження, яка позначена як така;
  її можна уточнити. Позначка paid зберігається без повторного віднімання.
- Регулярні витрати розподіляються за календарними днями місяця; річні —
  на 12 місяців. Початкові тарифи діють з початку місяця встановлення.
- USD/EUR/PLN: явний плановий курс або пов'язана фактична оплата у гривнях.
  Без курсу показник позначено попереднім, сума не видається за повну.
- Пов'язана банківська оплата замінює тариф за coverage_month. Для річної
  оплати це перший із 12 місяців покриття. Частини оплати сумуються.
- Окремі банківські витрати віднімаються після явного підтвердження;
  інші списання показані як неперевірені. Особисті перекази виключаються.
- Раніше внесені ручні бізнес-витрати враховані. Для оплати, яка дублює
  ручний запис, є зв'язок «Вже внесено у старі Операції».
- Дані розрахунку не є підтвердженим чистим прибутком до внесення всіх
  виплат готелям, податків та витрат з інших рахунків.

## Дані та запуск

Міграція `supabase/migrations/20261030_independent_finance.sql` створює
чотири таблиці `aura_finance_*` із тим самим обмеженням власника, що й
існуюча AURA. Анонімний доступ відсутній. Вона не змінює старі дані.
Тригер лише читає зміни returns та оновлює нову таблицю. Власний збій
тригера не перериває існуючу синхронізацію CRM.

Спочатку застосувати міграцію, потім перевірити preview, потім публікувати.
У разі відкату повернути попереднє розгортання; нові таблиці можна залишити,
вони не впливають на старі формули. За потреби вимкнути лише новий тригер:
`ALTER TABLE public.findash_data DISABLE TRIGGER aura_capture_finance_returns;`
Дані нового модуля при відкаті не видаляти.

## Перевірка

`node --test tests/finance.test.mjs`
`npm run build`

Ручні перевірки: змінити період; внести витрату; зв'язати списання з
підпискою й поверненням; уточнити дату повернення; перевірити вузький екран.
Тарифи при зміні перераховують історію. Для зміни тарифу з певної дати
завершити старий запис і створити новий. Домени/хостинг додаються після
отримання фактичних сум та строків оплати.


## Optional payment splits (2026-11-03)

Bank → «Розподіл» on an incoming payment: select hotel, its share and optional due date. Unsplit receipts retain their full value. Bank source rows and legacy `findash_data` are not rewritten. Rings now use own income (gross minus hotel share), keeping goal settings and layout. The independent green card also deducts ordinary expenses/refunds. Other legacy revenue/expense cards and charts retain their existing gross-accounting formulas.

Hotel liabilities appear in Dashboard creditor total / upcoming payments (when due is set), Debts → «Виплати закладам», and Returns → «Виплати закладам». Link actual outgoing bank payments to settle in full or in parts. Each outgoing payment can settle one split only and is linked for its entire amount; combined transfers covering several splits and payments outside this bank are not supported in this release. Settlement never deducts own income twice. Correct a mistaken link by unlinking it; the bank payment remains unchanged. A split cannot be reduced below settled amounts or change hotel after settlement. Cancellation uses a zero amount, retaining the stable integration identity.

### Future CRM contract — DISABLED

`public.aura_hotel_debt_export` is an owner-authorized, read-only `security_invoker` view with `external_ref`, bank ID, hotel, optional CRM deal ID, due date, total/paid/outstanding amount, status and `crm_sync_enabled=false`. It is a full snapshot contract: a future connector must upsert by `external_ref`, including paid/cancelled records; do not use `updated_at` as a deletion/change cursor. Hotel matching and CRM deal mapping must be configured and approved before enabling any sender. There is no sender, cron, network request, CRM stage update or mutation to existing CRM functions. Existing `sync_new_payments_to_scope` only observes legacy data and is not triggered by these tables.

### Validation

`node --test tests/*.mjs`: 17 calculation cases. `tests/splits.sql`: transaction rollback fixtures for owner/RLS, validation, partial/full settlement, cancellation and duplicate-expense rejection in both directions. Executed in isolated PostgreSQL (PGlite), not with live payment data. Production schema and grants checked read-only. `AURA_QA_MODULES=/path/to/node_modules node tests/splits.dom.cjs`: DOM interaction test using jsdom and a mocked store. This is not a signed-in browser end-to-end test.
