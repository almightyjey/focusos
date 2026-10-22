import { addDaysToKey, dayKey, utcToZonedInput, zonedInputToUtc } from "@/domain/datetime";
import { parseWeeklyRule, weeklyOccurrenceDays } from "@/domain/recurrence";
import type { EventKind, ScheduleEvent } from "@/domain/types";

/** Una aparición concreta de un evento en el calendario. */
export type EventOccurrence = {
  /** Único por ocurrencia: id del evento + día local. */
  key: string;
  eventId: string;
  title: string;
  kind: EventKind;
  subjectId: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  recurring: boolean;
};

function overlaps(startMs: number, endMs: number, rangeStartMs: number, rangeEndMs: number) {
  // Un evento de duración cero (un instante) cuenta si cae dentro del rango.
  return startMs < rangeEndMs && (endMs > rangeStartMs || (endMs === startMs && startMs >= rangeStartMs));
}

/**
 * Expande eventos (únicos y semanales) a ocurrencias dentro de [startIso, endIso).
 * Las repeticiones se calculan en la zona del evento, así una clase a las 10:00
 * sigue a las 10:00 locales aunque cambie el horario de verano.
 */
export function expandOccurrences(
  events: ScheduleEvent[],
  startIso: string,
  endIso: string,
  fallbackTimeZone: string,
): EventOccurrence[] {
  const rangeStart = Date.parse(startIso);
  const rangeEnd = Date.parse(endIso);
  const occurrences: EventOccurrence[] = [];

  for (const event of events) {
    const start = Date.parse(event.startsAt);
    const end = Date.parse(event.endsAt);
    const tz = event.timezone ?? fallbackTimeZone;
    const base = {
      eventId: event.id,
      title: event.title,
      kind: event.kind,
      subjectId: event.subjectId,
      location: event.location,
      allDay: event.allDay,
    };

    const rule = event.recurrenceRule ? parseWeeklyRule(event.recurrenceRule) : null;
    if (!rule) {
      if (overlaps(start, end, rangeStart, rangeEnd)) {
        occurrences.push({
          ...base,
          key: `${event.id}:${dayKey(event.startsAt, tz)}`,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          recurring: false,
        });
      }
      continue;
    }

    const first = utcToZonedInput(event.startsAt, tz);
    const durationMs = end - start;
    // Un día de margen a cada lado cubre diferencias entre la zona del evento y la de la vista.
    const fromKey = addDaysToKey(dayKey(startIso, tz), -1);
    const toKey = addDaysToKey(dayKey(endIso, tz), 1);

    for (const key of weeklyOccurrenceDays(first.date, rule, fromKey, toKey)) {
      const occurrenceStart = zonedInputToUtc(key, event.allDay ? "00:00" : first.time, tz).getTime();
      const occurrenceEnd = occurrenceStart + durationMs;
      if (!overlaps(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)) continue;
      occurrences.push({
        ...base,
        key: `${event.id}:${key}`,
        startsAt: new Date(occurrenceStart).toISOString(),
        endsAt: new Date(occurrenceEnd).toISOString(),
        recurring: true,
      });
    }
  }

  return occurrences.sort(compareOccurrences);
}

export function compareOccurrences(a: EventOccurrence, b: EventOccurrence): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return (
    Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
    Date.parse(a.endsAt) - Date.parse(b.endsAt) ||
    a.title.localeCompare(b.title, "es")
  );
}

/** Ocurrencias de cada día local. Los eventos de todo el día aparecen en cada día que cubren. */
export function occurrencesByDay(
  occurrences: EventOccurrence[],
  dayKeys: string[],
  timeZone: string,
): Map<string, EventOccurrence[]> {
  const byDay = new Map<string, EventOccurrence[]>(dayKeys.map((key) => [key, []]));
  for (const occurrence of occurrences) {
    if (occurrence.allDay) {
      const lastMoment = new Date(Date.parse(occurrence.endsAt) - 1).toISOString();
      const firstKey = dayKey(occurrence.startsAt, timeZone);
      const lastKey = dayKey(lastMoment > occurrence.startsAt ? lastMoment : occurrence.startsAt, timeZone);
      for (let key = firstKey; key <= lastKey; key = addDaysToKey(key, 1)) {
        byDay.get(key)?.push(occurrence);
      }
    } else {
      byDay.get(dayKey(occurrence.startsAt, timeZone))?.push(occurrence);
    }
  }
  return byDay;
}

/** Minutos desde la medianoche local. */
export function minutesOfDay(instant: string, timeZone: string): number {
  const { time } = utcToZonedInput(instant, timeZone);
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export type PositionedOccurrence = {
  occurrence: EventOccurrence;
  /** Minutos desde la medianoche local del día mostrado. */
  startMinute: number;
  endMinute: number;
  /** Columna dentro de su grupo de solapes y total de columnas del grupo. */
  column: number;
  columns: number;
};

/**
 * Coloca eventos con hora de un día en columnas para que los solapados se vean
 * lado a lado. Lo que pasa de medianoche se corta al final del día.
 */
export function layoutDay(
  occurrences: EventOccurrence[],
  day: string,
  timeZone: string,
  minDurationMinutes = 20,
): PositionedOccurrence[] {
  const items = occurrences
    .filter((occurrence) => !occurrence.allDay)
    .map((occurrence) => {
      const startMinute = minutesOfDay(occurrence.startsAt, timeZone);
      const endsSameDay = dayKey(occurrence.endsAt, timeZone) === day;
      const rawEnd = endsSameDay ? minutesOfDay(occurrence.endsAt, timeZone) : 24 * 60;
      const endMinute = Math.min(24 * 60, Math.max(rawEnd, startMinute + minDurationMinutes));
      return { occurrence, startMinute, endMinute, column: 0, columns: 1 };
    })
    .sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute);

  let cluster: PositionedOccurrence[] = [];
  let clusterEnd = -1;
  const columnEnds: number[] = [];

  const closeCluster = () => {
    const total = columnEnds.length || 1;
    for (const item of cluster) item.columns = total;
    cluster = [];
    columnEnds.length = 0;
  };

  for (const item of items) {
    if (item.startMinute >= clusterEnd) closeCluster();
    let column = columnEnds.findIndex((end) => end <= item.startMinute);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(item.endMinute);
    } else {
      columnEnds[column] = item.endMinute;
    }
    item.column = column;
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMinute);
  }
  closeCluster();

  return items;
}

/** Rango de horas visible en la vista semanal: 7:00–21:00 ampliado si hace falta. */
export function visibleHours(positioned: PositionedOccurrence[], defaults = { start: 7, end: 21 }) {
  let start = defaults.start;
  let end = defaults.end;
  for (const item of positioned) {
    start = Math.min(start, Math.floor(item.startMinute / 60));
    end = Math.max(end, Math.ceil(item.endMinute / 60));
  }
  return { start, end: Math.min(24, end) };
}
