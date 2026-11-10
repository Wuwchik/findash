import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as L from "./logic.ts";

// tax-dps-sync — Електронний кабінет ДПС → A.U.R.A (рішення власника 07.11.2026).
// Лише ЧИТАННЯ з API приватної частини кабінету: стан розрахунків, операції, вхідні листи, подана звітність.
// Нічого не подає й не сплачує. Авторизація ДПС — підписаний КЕП РНОКПП із секрету Vault dps_auth_token;
// сам КЕП і пароль A.U.R.A не бачить.
//
// Дії (POST JSON { action }):
//   sync        — розклад pg_cron (кожні 15 хв) або кнопка «Оновити» (власник: без затримки)
//   set_token   — власник вставляє підписаний токен: перевіряємо в ДПС, кладемо у Vault, одразу синхронізуємо
//   clear_token — власник відключає ДПС
//   import_token — одноразовий імпорт підпису скриптом з комп'ютера власника (заголовок x-import-key)
//   file        — власник відкриває PDF листа / звіту (лише дозволені шляхи ДПС)
// Telegram (необов'язково): секрети Vault telegram_bot_token, telegram_chat_id.

const OWNER_EMAIL = "wuwchik1@gmail.com";
const CRON_MIN_INTERVAL_MS = 5 * 60_000;     // захист від частих викликів публічним ключем
const REPORTS_INTERVAL_MS = 60 * 60_000;     // звітність перечитуємо щогодини
const MAX_LETTER_PAGES = 5;
const MAX_OPERATION_PAGES = 3;

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-import-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

class DpsError extends Error {
  constructor(public status: number, message: string) { super(message); }
  // ДПС відповідає 400 «Помилка перевірки підпису: хибний підпис», коли підпис РНОКПП застарів
  get rejected() { return this.status === 401 || this.status === 403 || (this.status === 400 && /підпис/i.test(this.message)); }
}

async function dps(token: string, path: string, accept = "application/json"): Promise<Response> {
  const res = await fetch(L.DPS_BASE + path, {
    headers: { Authorization: token, Accept: accept, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => "")).slice(0, 300);
    throw new DpsError(res.status, `ДПС ${res.status} ${path.split("?")[0]}${text ? `: ${text}` : ""}`);
  }
  return res;
}
const dpsJson = async (token: string, path: string) => (await dps(token, path)).json();

async function secret(name: string): Promise<string | null> {
  const { data, error } = await db.rpc("get_secret", { secret_name: name });
  return error || !data ? null : String(data);
}

async function telegram(text: string): Promise<boolean> {
  const [bot, chat] = await Promise.all([secret("telegram_bot_token"), secret("telegram_chat_id")]);
  if (!bot || !chat) return false;
  const res = await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return !!res?.ok;
}

async function isOwner(req: Request): Promise<boolean> {
  const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return false;
  const { data } = await db.auth.getUser(jwt);
  return data.user?.email === OWNER_EMAIL;
}

const must = <T,>(r: { data: T; error: { message: string } | null }, what: string): T => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

type State = { token_status: string; last_attempt_at: string | null; last_ok_at: string | null; reports_synced_at: string | null; alerted_status: string | null };

async function setState(patch: Record<string, unknown>) {
  must(await db.from("aura_tax_dps_state").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", "main"), "стан");
}

async function syncAccounts(token: string, now: Date, notify: boolean) {
  const years = L.accountYears(now);
  const prevRows = must(await db.from("aura_tax_dps_accounts").select("*").in("year", years), "рахунки") as L.Account[];
  const prev = new Map(prevRows.map((a) => [a.id, a]));
  let payerName: string | null = null;
  const alerts: string[] = [];
  let ops = 0;
  for (const year of years) {
    const raw = await dpsJson(token, `ta/splatp?year=${year}`);
    payerName ??= L.payerNameOf(raw);
    const accounts = L.mapAccounts(raw, year);
    if (accounts.length) {
      must(await db.from("aura_tax_dps_accounts").upsert(accounts.map((a) => ({ ...a, updated_at: now.toISOString() }))), "запис рахунків");
    }
    for (const a of accounts) {
      const before = prev.get(a.id);
      if (notify) { const msg = L.debtAlert(before, a); if (msg) alerts.push(msg); }
      if (!L.accountChanged(before, a) || a.csti == null) continue;
      for (let page = 0; page < MAX_OPERATION_PAGES; page++) {
        const body = await dpsJson(token, `ta/splatp/${year}/${a.csti}/${encodeURIComponent(a.idpmnt)}/pa?page=${page}`).catch((e) => {
          if (e instanceof DpsError && e.rejected) throw e;
          console.warn("операції рахунку", a.id, e.message);
          return null;
        });
        const rows = L.mapOperations(body, a.id);
        if (rows.length) { must(await db.from("aura_tax_dps_operations").upsert(rows), "запис операцій"); ops += rows.length; }
        if (!body || body.last !== false) break;
      }
    }
  }
  return { payerName, alerts, ops };
}

async function syncLetters(token: string, notify: boolean) {
  const fresh: L.Letter[] = [];
  let seen = 0;
  for (let page = 0; page < MAX_LETTER_PAGES; page++) {
    const { letters, last } = L.mapLetters(await dpsJson(token, `post/incoming?page=${page}`));
    if (!letters.length) break;
    const known = new Set((must(await db.from("aura_tax_dps_letters").select("id").in("id", letters.map((l) => l.id)), "листи") as { id: string }[]).map((r) => r.id));
    // уже відомі: оновлюємо лише «прочитано в кабінеті» і статус
    const old = letters.filter((l) => known.has(l.id));
    for (const l of old) await db.from("aura_tax_dps_letters").update({ read_in_dps: l.read_in_dps, status: l.status }).eq("id", l.id);
    seen += old.length;
    fresh.push(...letters.filter((l) => !known.has(l.id)));
    if (last || old.length) break;     // дійшли до вже відомих — далі старі
  }
  if (!fresh.length) return { fresh: 0, seen };
  const nowIso = new Date().toISOString();
  // перша синхронізація: історію не розсилаємо — інакше лавина з сотні старих квитанцій
  must(await db.from("aura_tax_dps_letters").insert(fresh.map((l) => ({ ...l, notified_at: notify ? null : nowIso }))), "запис листів");
  if (notify) {
    const sorted = [...fresh].sort((a, b) => String(a.date_in).localeCompare(String(b.date_in)));
    const head = sorted.slice(-10);
    const sent: string[] = [];
    if (sorted.length > head.length) await telegram(`🏛️ З податкової надійшло ${sorted.length} нових документів. Показую останні ${head.length}. Усі — A.U.R.A → 🏛️ Податки`);
    for (const l of head) if (await telegram(L.letterAlert(l))) sent.push(l.id);
    const mark = sorted.length > head.length ? sorted.map((l) => l.id) : sent;
    if (mark.length) await db.from("aura_tax_dps_letters").update({ notified_at: nowIso }).in("id", mark);
  }
  return { fresh: fresh.length, seen };
}

async function syncReports(token: string, now: Date) {
  let count = 0;
  for (const { year, month } of L.reportPeriods(now)) {
    const body = await dpsJson(token, `reg_doc/list?periodYear=${year}&periodMonth=${month}`).catch((e) => {
      if (e instanceof DpsError && e.rejected) throw e;
      console.warn("звітність", year, month, e.message);
      return null;
    });
    const rows = L.mapReports(body);
    if (rows.length) { must(await db.from("aura_tax_dps_reports").upsert(rows.map((r) => ({ ...r, updated_at: now.toISOString() }))), "запис звітності"); count += rows.length; }
  }
  return count;
}

async function sync(force: boolean) {
  const now = new Date();
  const state = must(await db.from("aura_tax_dps_state").select("*").eq("id", "main").single(), "стан") as State;
  if (!force && state.last_attempt_at && now.getTime() - Date.parse(state.last_attempt_at) < CRON_MIN_INTERVAL_MS) {
    return { skipped: true };
  }
  await setState({ last_attempt_at: now.toISOString() });
  const token = await secret("dps_auth_token");
  if (!token) { await setState({ token_status: "missing", last_error: null }); return { status: "missing" }; }

  const notify = !!state.last_ok_at;
  try {
    const acc = await syncAccounts(token, now, notify);
    const letters = await syncLetters(token, notify);
    const reportsDue = force || !state.reports_synced_at || now.getTime() - Date.parse(state.reports_synced_at) >= REPORTS_INTERVAL_MS;
    const reports = reportsDue ? await syncReports(token, now) : null;
    for (const a of acc.alerts) await telegram(a);
    if (state.alerted_status === "rejected") await telegram("✅ ДПС: підключення відновлено, дані з Електронного кабінету знову оновлюються.");
    await setState({
      token_status: "ok", last_ok_at: now.toISOString(), last_error: null, alerted_status: null,
      ...(acc.payerName ? { payer_name: acc.payerName } : {}),
      ...(reportsDue ? { reports_synced_at: now.toISOString() } : {}),
    });
    return { status: "ok", operations: acc.ops, newLetters: letters.fresh, reports };
  } catch (e) {
    const err = e as Error;
    if (e instanceof DpsError && e.rejected) {
      if (state.alerted_status !== "rejected") {
        await telegram("🔐 ДПС не прийняла підпис A.U.R.A — дані з Електронного кабінету не оновлюються.\nПідпишіть РНОКПП заново: A.U.R.A → 🏛️ Податки → «Підключити ДПС».");
      }
      await setState({ token_status: "rejected", last_error: err.message, alerted_status: "rejected" });
      return { status: "rejected", error: err.message };
    }
    await setState({ token_status: state.token_status === "missing" ? "error" : state.token_status, last_error: err.message });
    return { status: "error", error: err.message };
  }
}

async function connectToken(input: unknown): Promise<Response> {
  const token = L.normalizeToken(input);
  if (!token) return json(400, { error: "Це не схоже на підписаний файл у Base64 (має починатися з MII…). Перевірте, що скопійовано повністю." });
  try {
    await dps(token, `ta/splatp?year=${new Date().getUTCFullYear()}`);
  } catch (e) {
    const msg = e instanceof DpsError && e.rejected
      ? "ДПС не прийняла підпис. Перевірте, що підписано саме ваш РНОКПП (лише цифри), підпис внутрішній, сертифікат додано."
      : `ДПС не відповіла: ${(e as Error).message}`;
    return json(400, { error: msg });
  }
  must(await db.rpc("aura_set_dps_token", { token }), "збереження токена");
  await setState({ token_status: "ok", last_error: null, last_ok_at: null, reports_synced_at: null, alerted_status: null });
  return json(200, await sync(true));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Лише POST" });
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "sync");

    if (action === "sync") {
      const owner = await isOwner(req);
      return json(200, await sync(owner && body.force === true));
    }

    // Одноразовий імпорт з комп'ютера власника (scripts/import-dps-token.mjs): ключ dps_import_key у Vault,
    // формат «ключ|строк дії ISO»; після успіху ключ видаляється. Сам підпис ніде не показується.
    if (action === "import_token") {
      const stored = await secret("dps_import_key");
      const [key, until] = (stored ?? "").split("|");
      const given = req.headers.get("x-import-key") ?? "";
      if (!key || key.length < 32 || given !== key || !until || Date.parse(until) < Date.now()) return json(403, { error: "Ключ імпорту недійсний або прострочений" });
      const res = await connectToken(body.token);
      if (res.status === 200) await db.rpc("aura_drop_dps_import_key");
      return res;
    }

    if (!(await isOwner(req))) return json(403, { error: "Лише власник A.U.R.A" });

    if (action === "set_token") return await connectToken(body.token);

    if (action === "clear_token") {
      must(await db.rpc("aura_set_dps_token", { token: "" }), "видалення токена");
      await setState({ token_status: "missing", last_error: null, alerted_status: null });
      return json(200, { status: "missing" });
    }

    if (action === "file") {
      const token = await secret("dps_auth_token");
      if (!token) return json(409, { error: "ДПС не підключено" });
      const years = [body.year, body.alt_year].filter((y, i, a) => y && a.indexOf(y) === i);
      const paths = years.flatMap((y) => L.filePaths(body.kind, y, body.id) ?? []);
      if (!paths.length) return json(400, { error: "Невірний документ" });
      let last: Error | null = null;
      for (const p of paths) {
        try {
          const res = await dps(token, p, "application/pdf");
          if (body.kind === "letter") await db.from("aura_tax_dps_letters").update({ seen_at: new Date().toISOString() }).eq("id", String(body.id)).is("seen_at", null);
          return new Response(res.body, { status: 200, headers: { ...CORS, "Content-Type": "application/pdf", "Cache-Control": "no-store" } });
        } catch (e) {
          last = e as Error;
          if (e instanceof DpsError && e.rejected) break;
        }
      }
      return json(502, { error: last?.message ?? "Документ недоступний" });
    }

    return json(400, { error: `Невідома дія ${action}` });
  } catch (e) {
    console.error("tax-dps-sync", (e as Error).message);
    return json(500, { error: (e as Error).message });
  }
});
