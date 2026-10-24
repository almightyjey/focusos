import { addDaysToKey, dayKey, zonedInputToUtc } from "@/domain/datetime";
import type { EventOccurrence } from "@/domain/events";
import type { PriorityLevel, Task } from "@/domain/types";
import { freeSlots, type FreeSlot } from "@/planner/availability";
import { planDay, type DayPlan } from "@/planner/plan";
import { rankTasks, type Recommendation } from "@/planner/scoring";

export { FACTOR_LABELS, WEIGHTS, type FactorKey, type Recommendation } from "@/planner/scoring";
export type { DayPlan, PlanBlock } from "@/planner/plan";
export type { FreeSlot } from "@/planner/availability";

/** Días hacia adelante en los que se mira el tiempo libre (para detectar riesgo). */
export const HORIZON_DAYS = 14;

export type PlannerInput = {
  tasks: Task[];
  subjectPriority: Map<string, PriorityLevel>;
  /** Ocurrencias de eventos entre hoy y el fin del horizonte. */
  occurrences: EventOccurrence[];
  now: Date;
  timeZone: string;
  studyWindow: { start: number; end: number };
};

export type PlannerOutput = {
  ranking: Recommendation[];
  today: DayPlan;
  slots: FreeSlot[];
  todayKey: string;
};

/** Rango [hoy 00:00, hoy + horizonte) en UTC para cargar los eventos que necesita el motor. */
export function plannerRange(now: Date, timeZone: string) {
  const todayKey = dayKey(now, timeZone);
  return {
    startIso: zonedInputToUtc(todayKey, "00:00", timeZone).toISOString(),
    endIso: zonedInputToUtc(addDaysToKey(todayKey, HORIZON_DAYS), "00:00", timeZone).toISOString(),
  };
}

/** Punto de entrada del motor: función pura de sus entradas. */
export function buildPlan(input: PlannerInput): PlannerOutput {
  const todayKey = dayKey(input.now, input.timeZone);
  const slots = freeSlots({
    startKey: todayKey,
    days: HORIZON_DAYS,
    timeZone: input.timeZone,
    window: input.studyWindow,
    occurrences: input.occurrences,
    now: input.now,
  });
  const horizonEnd = new Date(plannerRange(input.now, input.timeZone).endIso);
  const ranking = rankTasks({
    tasks: input.tasks,
    subjectPriority: input.subjectPriority,
    slots,
    horizonEnd,
    now: input.now,
    timeZone: input.timeZone,
  });
  return {
    ranking,
    today: planDay({ ranking, slots, day: todayKey, now: input.now, timeZone: input.timeZone }),
    slots,
    todayKey,
  };
}
