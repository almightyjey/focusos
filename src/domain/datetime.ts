import { TZDate } from "@date-fns/tz";

// Estrategia de zona horaria
//  * La base guarda instantes (timestamptz, UTC).
//  * La interfaz trabaja con fecha y hora locales de la zona del perfil.
//  * La conversión ocurre aquí y solo aquí.

export const DEFAULT_TIMEZONE = "America/Santo_Domingo";
export const DEFAULT_LOCALE = "es-DO";
/** Hora asignada cuando una entrega solo tiene fecha. */
export const DEFAULT_DUE_TIME = "23:59";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function isValidDateInput(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isValidTimeInput(value: string): boolean {
  return TIME_RE.test(value);
}

/** Convierte fecha y hora locales (en `timeZone`) a un instante UTC. */
export function zonedInputToUtc(date: string, time: string, timeZone: string): Date {
  if (!isValidDateInput(date)) throw new RangeError(`Fecha no válida: ${date}`);
  if (!isValidTimeInput(time)) throw new RangeError(`Hora no válida: ${time}`);
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const zoned = new TZDate(year, month - 1, day, hours, minutes, 0, 0, timeZone);
  return new Date(zoned.getTime());
}

type ZonedParts = { year: string; month: string; day: string; hour: string; minute: string };

function zonedParts(instant: Date | string, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** Fecha y hora locales para rellenar un formulario. */
export function utcToZonedInput(instant: Date | string, timeZone: string) {
  const p = zonedParts(instant, timeZone);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Día del calendario (YYYY-MM-DD) en el que cae el instante en `timeZone`. */
export function dayKey(instant: Date | string, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Suma días a un día del calendario sin depender de la zona del sistema. */
export function addDaysToKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo) de un día del calendario. */
export function weekdayOfKey(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Primer día de la semana que contiene `key`. */
export function startOfWeekKey(key: string, weekStartsOn: number): string {
  const offset = (weekdayOfKey(key) - weekStartsOn + 7) % 7;
  return addDaysToKey(key, -offset);
}

/** Diferencia en días de calendario entre dos días (b - a). */
export function daysBetweenKeys(a: string, b: string): number {
  const toUtc = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

function formatTime(instant: Date | string, timeZone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant));
}

/** Etiqueta corta para fechas límite: "Hoy, 23:59", "Mañana, 10:00", "vie, 24 oct, 23:59". */
export function formatDueLabel(
  dueAt: string,
  now: Date,
  timeZone: string,
  locale: string = DEFAULT_LOCALE,
): string {
  const dueKey = dayKey(dueAt, timeZone);
  const todayKey = dayKey(now, timeZone);
  const diff = daysBetweenKeys(todayKey, dueKey);
  const time = formatTime(dueAt, timeZone, locale);

  if (diff === 0) return `Hoy, ${time}`;
  if (diff === 1) return `Mañana, ${time}`;
  if (diff === -1) return `Ayer, ${time}`;

  const sameYear = dueKey.slice(0, 4) === todayKey.slice(0, 4);
  const date = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(new Date(dueAt));
  return `${date}, ${time}`;
}

/** "miércoles, 22 de octubre" */
export function formatLongDate(instant: Date, timeZone: string, locale: string = DEFAULT_LOCALE) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(instant);
}

/** Día corto para agrupar: "Jue, 23 oct". */
export function formatDayHeading(key: string, locale: string = DEFAULT_LOCALE) {
  const [year, month, day] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "1 h 30 min", "45 min" */
export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}
