import { addDaysToKey, isValidDateInput, weekdayOfKey } from "@/domain/datetime";

// Subconjunto de RFC 5545 que entiende FocusOS por ahora:
//   FREQ=WEEKLY;BYDAY=MO,WE[;UNTIL=YYYYMMDD]
// UNTIL es una fecha local inclusiva (último día con ocurrencia) en la zona
// del evento. Reglas más complejas (importaciones futuras) se tratan como un
// evento sin repetición hasta que se soporten.

const CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

export type WeeklyRule = {
  /** Días de la semana, 0 = domingo … 6 = sábado, ordenados y sin repetir. */
  byDay: number[];
  /** Último día (YYYY-MM-DD) con ocurrencia, inclusivo; null = sin fin. */
  until: string | null;
};

function normalizeDays(days: number[]): number[] {
  return [...new Set(days)].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).sort();
}

export function buildWeeklyRule(byDay: number[], until: string | null): string {
  const days = normalizeDays(byDay);
  if (days.length === 0) throw new RangeError("La repetición semanal necesita al menos un día");
  if (until !== null && !isValidDateInput(until)) throw new RangeError(`Fecha no válida: ${until}`);
  const parts = ["FREQ=WEEKLY", `BYDAY=${days.map((day) => CODES[day]).join(",")}`];
  if (until) parts.push(`UNTIL=${until.replaceAll("-", "")}`);
  return parts.join(";");
}

export function parseWeeklyRule(rule: string): WeeklyRule | null {
  const fields = new Map<string, string>();
  for (const part of rule.trim().split(";")) {
    const [key, value] = part.split("=");
    if (!key || value === undefined || fields.has(key)) return null;
    fields.set(key.toUpperCase(), value.toUpperCase());
  }
  if (fields.get("FREQ") !== "WEEKLY") return null;
  for (const key of fields.keys()) {
    if (!["FREQ", "BYDAY", "UNTIL"].includes(key)) return null;
  }

  const codes = fields.get("BYDAY")?.split(",") ?? [];
  const byDay = codes.map((code) => CODES.indexOf(code as (typeof CODES)[number]));
  if (byDay.length === 0 || byDay.some((day) => day < 0)) return null;

  let until: string | null = null;
  const rawUntil = fields.get("UNTIL");
  if (rawUntil !== undefined) {
    const match = /^(\d{4})(\d{2})(\d{2})$/.exec(rawUntil);
    if (!match) return null;
    until = `${match[1]}-${match[2]}-${match[3]}`;
    if (!isValidDateInput(until)) return null;
  }

  return { byDay: normalizeDays(byDay), until };
}

/** Primer día en o después de `fromKey` cuyo día de la semana está en `byDay`. */
export function firstWeekdayOnOrAfter(fromKey: string, byDay: number[]): string {
  const days = normalizeDays(byDay);
  if (days.length === 0) throw new RangeError("La repetición semanal necesita al menos un día");
  for (let offset = 0; offset < 7; offset += 1) {
    const key = addDaysToKey(fromKey, offset);
    if (days.includes(weekdayOfKey(key))) return key;
  }
  /* c8 ignore next */
  throw new Error("Inalcanzable");
}

/** Días del calendario con ocurrencia dentro de [fromKey, toKey] (inclusivo). */
export function weeklyOccurrenceDays(
  seriesStartKey: string,
  rule: WeeklyRule,
  fromKey: string,
  toKey: string,
): string[] {
  const start = fromKey > seriesStartKey ? fromKey : seriesStartKey;
  const end = rule.until !== null && rule.until < toKey ? rule.until : toKey;
  const days: string[] = [];
  for (let key = start; key <= end; key = addDaysToKey(key, 1)) {
    if (rule.byDay.includes(weekdayOfKey(key))) days.push(key);
  }
  return days;
}

const SHORT_DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** "Cada semana: lun y mié, hasta el 15 dic" */
export function describeWeeklyRule(rule: WeeklyRule, locale = "es-DO"): string {
  const names = rule.byDay.map((day) => SHORT_DAYS[day]);
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  if (!rule.until) return `Cada semana: ${list}`;
  const [year, month, day] = rule.until.split("-").map(Number);
  const until = new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "short" }).format(
    new Date(Date.UTC(year, month - 1, day, 12)),
  );
  return `Cada semana: ${list}, hasta el ${until}`;
}
