// Чиста логіка tax-dps-sync: розбір відповідей API ДПС, порівняння змін, тексти сповіщень.
// Без мережі й бази — щоб перевірялось тестами (node --test tests/taxDps.test.mjs).

export const DPS_BASE = "https://cabinet.tax.gov.ua/ws/public_api/";

// deno-lint-ignore no-explicit-any
type Raw = Record<string, any>;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};
const str = (v: unknown): string | null => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());

/** "2021-05-05 16:11:32" (час Києва) → ISO з правильним зсувом Europe/Kyiv */
export function kyivToIso(s: unknown): string | null {
  const m = String(s ?? "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", se = "00"] = m;
  const asUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
  // зсув Києва в цей момент (+02:00 взимку, +03:00 влітку)
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Kyiv", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(asUtc));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const offset = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - asUtc;
  return new Date(asUtc - offset).toISOString();
}

/** "05.12.2019" → "2019-12-05" */
export function dmyToIso(s: unknown): string | null {
  const m = String(s ?? "").match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export type Account = {
  id: string; year: number; idpmnt: string; csti: number | null; sti_name: string | null; budget_code: string | null; name: string | null;
  accrued: number | null; paid: number | null; refunded: number | null; penalty: number | null; arrears: number | null;
  overpaid: number | null; penalty_balance: number | null; balance: number | null;
  iban: string | null; recipient_code: string | null; recipient_name: string | null; bank_name: string | null;
};

/** plat1 "30 11011000 00" → "11011000" (код бюджетної класифікації) */
const budgetCode = (plat1: unknown) => {
  const m = String(plat1 ?? "").match(/\b(\d{8})\b/);
  return m ? m[1] : str(plat1);
};

export function mapAccounts(rows: unknown, year: number): Account[] {
  if (!Array.isArray(rows)) return [];
  return (rows as Raw[]).filter((r) => r && r.idpmnt).map((r) => ({
    id: `${year}:${r.idpmnt}`, year, idpmnt: String(r.idpmnt), csti: num(r.cSti), sti_name: str(r.nameSti),
    budget_code: budgetCode(r.plat1), name: str(r.namePlt),
    accrued: num(r.narah0), paid: num(r.splbd0), refunded: num(r.povbd0), penalty: num(r.penia0), arrears: num(r.nedoim0),
    overpaid: num(r.perepl0), penalty_balance: num(r.sldpn0), balance: num(r.debtAll),
    iban: str(r.budgetAccountIban), recipient_code: str(r.budgetTin), recipient_name: str(r.budgetPayerName), bank_name: str(r.budgetBankName),
  }));
}

export const payerNameOf = (rows: unknown): string | null =>
  Array.isArray(rows) ? str((rows as Raw[]).find((r) => r?.payerName)?.payerName) : null;

/** Чи змінились суми по рахунку — тоді варто перечитати його операції */
export function accountChanged(prev: Partial<Account> | undefined, next: Account): boolean {
  if (!prev) return true;
  const keys: (keyof Account)[] = ["accrued", "paid", "refunded", "penalty", "arrears", "overpaid", "penalty_balance", "balance"];
  return keys.some((k) => num(prev[k]) !== num(next[k]));
}

export type Operation = { id: string; account_id: string; op_date: string | null; code: string | null; name: string | null;
  amount: number | null; accrued: number | null; paid: number | null; comment: string | null };

export function mapOperations(body: unknown, accountId: string): Operation[] {
  const content = (body as Raw)?.content;
  if (!Array.isArray(content)) return [];
  return (content as Raw[]).filter((r) => r && r.rn != null && r.vidpa !== "Всього").map((r) => ({
    id: `${accountId}:${r.rn}`, account_id: accountId, op_date: dmyToIso(r.dateoper), code: str(r.vidpa), name: str(r.namevid),
    amount: num(r.isnull0), accrued: num(r.narah0), paid: num(r.splpov0), comment: str(r.templ),
  }));
}

export type Letter = { id: string; year: number | null; cdoc: string | null; name: string | null; date_in: string | null;
  read_in_dps: boolean; status: number | null };

export function mapLetters(body: unknown): { letters: Letter[]; last: boolean } {
  const b = body as Raw;
  const content = Array.isArray(b?.content) ? (b.content as Raw[]) : [];
  return {
    letters: content.filter((r) => r && r.id != null && !r.isDel).map((r) => ({
      id: String(r.id), year: num(r.periodYear) ?? (kyivToIso(r.dateIn) ? Number(kyivToIso(r.dateIn)!.slice(0, 4)) : null),
      cdoc: str(r.cdoc), name: str(r.name), date_in: kyivToIso(r.dateIn ?? r.operDate), read_in_dps: Number(r.isRead) === 1,
      status: num(r.status),
    })),
    last: b?.last !== false,
  };
}

export type Report = { id: string; ref_id: string | null; year: number | null; period_year: number | null; period_month: number | null;
  period_type: number | null; period: string | null; code: string | null; name: string | null; status: string | null;
  received_at: string | null; due_at: string | null; reg_number: string | null };

export function mapReports(body: unknown): Report[] {
  const content = (body as Raw)?.content;
  if (!Array.isArray(content)) return [];
  return (content as Raw[]).filter((r) => r && r.codRegdoc != null).map((r) => ({
    id: String(r.codRegdoc), ref_id: r.codRegdocRef == null ? null : String(r.codRegdocRef),
    year: r.dget ? Number(String(r.dget).slice(0, 4)) : num(r.periodYear),
    period_year: num(r.periodYear), period_month: num(r.periodMonth), period_type: num(r.periodType), period: str(r.period),
    code: str(r.doc ?? r.cdoc), name: str(r.docName), status: str(r.flagName)?.replace(/\s*\n\s*/g, " ") ?? null,
    received_at: kyivToIso(r.dget), due_at: kyivToIso(r.dterm), reg_number: r.nreg == null ? null : String(r.nreg),
  }));
}

/** Місяці звітних періодів, які перевіряємо: останні 4 місяці + кінці кварталів поточного й минулого року */
export function reportPeriods(now: Date): { year: number; month: number }[] {
  const out = new Map<string, { year: number; month: number }>();
  const add = (y: number, m: number) => out.set(`${y}-${m}`, { year: y, month: m });
  for (let k = 0; k < 4; k++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 15));
    add(d.getUTCFullYear(), d.getUTCMonth() + 1);
  }
  for (const y of [now.getUTCFullYear() - 1, now.getUTCFullYear()]) for (const m of [3, 6, 9, 12]) {
    if (Date.UTC(y, m - 1, 1) <= now.getTime()) add(y, m);
  }
  return [...out.values()];
}

/** Роки для стану розрахунків: поточний; у січні–лютому ще й минулий (річні нарахування й доплати) */
export const accountYears = (now: Date) => now.getUTCMonth() <= 1 ? [now.getUTCFullYear() - 1, now.getUTCFullYear()] : [now.getUTCFullYear()];

const uah = (n: number | null) => n == null ? "—" : new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(n) + " ₴";

/** Борг виріс (недоїмка або пеня) — повідомлення; null — нема чого казати */
export function debtAlert(prev: Partial<Account> | undefined, next: Account): string | null {
  const a0 = num(prev?.arrears) ?? 0, a1 = next.arrears ?? 0;
  const p0 = num(prev?.penalty_balance) ?? 0, p1 = next.penalty_balance ?? 0;
  if (a1 <= a0 + 0.009 && p1 <= p0 + 0.009) return null;
  if (a1 <= 0.009 && p1 <= 0.009) return null;
  const lines = [`⚠️ Податковий борг: ${next.name ?? next.budget_code ?? "рахунок"}`];
  if (a1 > 0.009) lines.push(`Недоїмка: ${uah(a1)}`);
  if (p1 > 0.009) lines.push(`Пеня до сплати: ${uah(p1)}`);
  if (next.iban) lines.push(`Сплатити на: ${next.iban} (код отримувача ${next.recipient_code ?? "—"})`);
  lines.push("Деталі: A.U.R.A → 🏛️ Податки");
  return lines.join("\n");
}

export function letterAlert(l: Letter): string {
  const when = l.date_in ? new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(l.date_in)) : "";
  return `🏛️ Новий документ з податкової\n${l.name ?? l.cdoc ?? "Документ"}${when ? `\nНадійшов: ${when}` : ""}\nВідкрити: A.U.R.A → 🏛️ Податки`;
}

/** Схоже на підписаний PKCS#7 у Base64 (починається з MII…), без пробілів і зайвого */
export function normalizeToken(input: unknown): string | null {
  const t = String(input ?? "").replace(/^Authorization:\s*/i, "").replace(/\s+/g, "");
  if (t.length < 500 || t.length > 40000) return null;
  if (!/^MI[A-Za-z0-9+/]+=*$/.test(t)) return null;
  return t;
}

/** Дозволені файли (захист від підміни адреси): лише PDF листа або звіту, лише числові id */
export function filePaths(kind: unknown, year: unknown, id: unknown): string[] | null {
  const y = String(year ?? ""), i = String(id ?? "");
  if (!/^20\d{2}$/.test(y) || !/^\d{1,20}$/.test(i)) return null;
  if (kind === "letter") return [`post/incoming/${y}/${i}/pdf`, `incoming/${y}/${i}/pdf`];
  if (kind === "report") return [`reg_doc/doc/${y}/${i}/pdf`];
  return null;
}
