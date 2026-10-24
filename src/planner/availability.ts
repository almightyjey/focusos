import { addDaysToKey, minutesToTime, zonedInputToUtc } from "@/domain/datetime";
import type { EventOccurrence } from "@/domain/events";

/** Hueco libre para estudiar, en instantes UTC. */
export type FreeSlot = { dayKey: string; start: string; end: string; minutes: number };

/** Huecos más cortos que esto no se ofrecen para estudiar. */
export const MIN_SLOT_MINUTES = 15;

type Interval = { start: number; end: number };

/** Resta `cut` de cada intervalo de `base`. */
function subtract(base: Interval[], cut: Interval): Interval[] {
  return base.flatMap((interval) => {
    if (cut.end <= interval.start || cut.start >= interval.end) return [interval];
    const pieces: Interval[] = [];
    if (cut.start > interval.start) pieces.push({ start: interval.start, end: cut.start });
    if (cut.end < interval.end) pieces.push({ start: cut.end, end: interval.end });
    return pieces;
  });
}

/** Los bloques de estudio son tiempo para estudiar; los de todo el día no ocupan horas concretas. */
export function blocksTime(occurrence: EventOccurrence): boolean {
  return !occurrence.allDay && occurrence.kind !== "study_block";
}

/**
 * Tiempo libre de cada día: el horario de estudio del usuario menos los
 * eventos con hora del calendario y menos lo que ya pasó.
 */
export function freeSlots({
  startKey,
  days,
  timeZone,
  window,
  occurrences,
  now,
  minMinutes = MIN_SLOT_MINUTES,
}: {
  startKey: string;
  days: number;
  timeZone: string;
  window: { start: number; end: number };
  occurrences: EventOccurrence[];
  now: Date;
  minMinutes?: number;
}): FreeSlot[] {
  const busy = occurrences
    .filter(blocksTime)
    .map((o) => ({ start: Date.parse(o.startsAt), end: Date.parse(o.endsAt) }))
    .sort((a, b) => a.start - b.start);
  const slots: FreeSlot[] = [];

  for (let index = 0; index < days; index += 1) {
    const dayKey = addDaysToKey(startKey, index);
    const dayStart = zonedInputToUtc(dayKey, minutesToTime(window.start), timeZone).getTime();
    const dayEnd =
      window.end >= 1440
        ? zonedInputToUtc(addDaysToKey(dayKey, 1), "00:00", timeZone).getTime()
        : zonedInputToUtc(dayKey, minutesToTime(window.end), timeZone).getTime();
    const from = Math.max(dayStart, now.getTime());
    if (from >= dayEnd) continue;

    let free: Interval[] = [{ start: from, end: dayEnd }];
    for (const interval of busy) free = subtract(free, interval);

    for (const interval of free) {
      const minutes = Math.floor((interval.end - interval.start) / 60_000);
      if (minutes < minMinutes) continue;
      slots.push({
        dayKey,
        start: new Date(interval.start).toISOString(),
        end: new Date(interval.end).toISOString(),
        minutes,
      });
    }
  }
  return slots;
}

/** Minutos libres entre `from` y `until` según los huecos dados. */
export function freeMinutesBetween(slots: FreeSlot[], from: number, until: number): number {
  return slots.reduce((sum, slot) => {
    const start = Math.max(Date.parse(slot.start), from);
    const end = Math.min(Date.parse(slot.end), until);
    return end > start ? sum + Math.floor((end - start) / 60_000) : sum;
  }, 0);
}
