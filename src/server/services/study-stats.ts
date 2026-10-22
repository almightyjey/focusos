import "server-only";

import { rangeToUtc } from "@/domain/calendar";
import { addDaysToKey, dayKey, startOfWeekKey } from "@/domain/datetime";
import { expandOccurrences } from "@/domain/events";
import { plannedStudyMinutes, summarizeFocus, type FocusSummary } from "@/domain/sessions";
import type { Profile } from "@/domain/types";
import type { Session } from "@/server/auth";
import { listEventsInRange } from "@/server/services/events";
import { listCompletedSessions } from "@/server/services/sessions";

/** Enfoque de hoy y de la semana frente a los bloques de estudio planificados. */
export async function loadWeekStudyStats(
  session: Session,
  profile: Profile,
  now: Date,
): Promise<{ summary: FocusSummary; plannedMinutes: number }> {
  const startKey = startOfWeekKey(dayKey(now, profile.timezone), profile.weekStartsOn);
  const { startIso, endIso } = rangeToUtc({ startKey, endKey: addDaysToKey(startKey, 6) }, profile.timezone);
  const [sessions, events] = await Promise.all([
    listCompletedSessions(session, startIso),
    listEventsInRange(session, startIso, endIso),
  ]);
  return {
    summary: summarizeFocus(sessions, now, profile.timezone, profile.weekStartsOn),
    plannedMinutes: plannedStudyMinutes(expandOccurrences(events, startIso, endIso, profile.timezone)),
  };
}
