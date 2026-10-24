import "server-only";

import { expandOccurrences } from "@/domain/events";
import type { Profile, Subject } from "@/domain/types";
import { buildPlan, plannerRange, type PlannerOutput } from "@/planner";
import type { Session } from "@/server/auth";
import { listEventsInRange } from "@/server/services/events";
import { listSubjects } from "@/server/services/subjects";
import { listTasks } from "@/server/services/tasks";

/** Carga lo que necesita el motor y ejecuta el plan. El motor en sí es puro. */
export async function loadPlan(
  session: Session,
  profile: Profile,
  now: Date,
): Promise<{ plan: PlannerOutput; subjects: Subject[] }> {
  const { startIso, endIso } = plannerRange(now, profile.timezone);
  const [tasks, subjects, events] = await Promise.all([
    listTasks(session, { view: "open" }),
    listSubjects(session, { includeArchived: true }),
    listEventsInRange(session, startIso, endIso),
  ]);
  const plan = buildPlan({
    tasks,
    subjectPriority: new Map(subjects.map((subject) => [subject.id, subject.priority])),
    occurrences: expandOccurrences(events, startIso, endIso, profile.timezone),
    now,
    timeZone: profile.timezone,
    studyWindow: profile.studyWindow,
  });
  return { plan, subjects };
}
