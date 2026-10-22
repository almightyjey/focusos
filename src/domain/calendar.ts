import {
  addDaysToKey,
  DEFAULT_LOCALE,
  isValidDateInput,
  startOfWeekKey,
  zonedInputToUtc,
} from "@/domain/datetime";

export const CALENDAR_VIEWS = ["week", "month"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export type DayRange = {
  /** Primer día (YYYY-MM-DD), inclusivo. */
  startKey: string;
  /** Último día (YYYY-MM-DD), inclusivo. */
  endKey: string;
};

/** Los 7 días de la semana que contiene `anchorKey`. */
export function weekDays(anchorKey: string, weekStartsOn: number): string[] {
  const start = startOfWeekKey(anchorKey, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => addDaysToKey(start, index));
}

function firstOfMonth(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

function addMonths(key: string, months: number): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return date.toISOString().slice(0, 10);
}

/**
 * Semanas completas que cubren el mes de `anchorKey` (5 o 6 filas de 7 días),
 * empezando en el día configurado por el usuario.
 */
export function monthWeeks(anchorKey: string, weekStartsOn: number): string[][] {
  const first = firstOfMonth(anchorKey);
  const last = addDaysToKey(addMonths(first, 1), -1);
  const weeks: string[][] = [];
  for (let start = startOfWeekKey(first, weekStartsOn); start <= last; start = addDaysToKey(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDaysToKey(start, index)));
  }
  return weeks;
}

export function viewRange(view: CalendarView, anchorKey: string, weekStartsOn: number): DayRange {
  const days = view === "week" ? weekDays(anchorKey, weekStartsOn) : monthWeeks(anchorKey, weekStartsOn).flat();
  return { startKey: days[0], endKey: days[days.length - 1] };
}

/** Instantes UTC [inicio, fin) que cubren los días locales del rango. */
export function rangeToUtc(range: DayRange, timeZone: string): { startIso: string; endIso: string } {
  return {
    startIso: zonedInputToUtc(range.startKey, "00:00", timeZone).toISOString(),
    endIso: zonedInputToUtc(addDaysToKey(range.endKey, 1), "00:00", timeZone).toISOString(),
  };
}

/** Fecha ancla para "anterior" y "siguiente". En el mes se usa el día 1. */
export function shiftAnchor(view: CalendarView, anchorKey: string, direction: -1 | 1): string {
  return view === "week" ? addDaysToKey(anchorKey, 7 * direction) : addMonths(firstOfMonth(anchorKey), direction);
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** Valida la fecha de la URL y cae en `fallback` si no sirve. */
export function parseAnchor(value: unknown, fallback: string): string {
  return typeof value === "string" && isValidDateInput(value) ? value : fallback;
}

function utcNoon(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

/** "Octubre de 2026" */
export function formatMonthTitle(anchorKey: string, locale = DEFAULT_LOCALE): string {
  const label = new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "long", year: "numeric" }).format(
    utcNoon(anchorKey),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "19 al 25 de octubre de 2026" o "28 de septiembre al 4 de octubre de 2026" */
export function formatWeekTitle(days: string[], locale = DEFAULT_LOCALE): string {
  const first = days[0];
  const last = days[days.length - 1];
  const day = (key: string) => Number(key.slice(8, 10));
  const month = (key: string) =>
    new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "long" }).format(utcNoon(key));
  const year = (key: string) => key.slice(0, 4);

  if (year(first) !== year(last)) {
    return `${day(first)} de ${month(first)} de ${year(first)} al ${day(last)} de ${month(last)} de ${year(last)}`;
  }
  if (isSameMonth(first, last)) {
    return `${day(first)} al ${day(last)} de ${month(last)} de ${year(last)}`;
  }
  return `${day(first)} de ${month(first)} al ${day(last)} de ${month(last)} de ${year(last)}`;
}

/** "lunes, 19 de octubre" para etiquetas accesibles y encabezados de día. */
export function formatDayLong(key: string, locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(utcNoon(key));
}
