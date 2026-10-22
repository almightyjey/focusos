import "server-only";

import { addDaysToKey, zonedInputToUtc } from "@/domain/datetime";
import { buildWeeklyRule, firstWeekdayOnOrAfter } from "@/domain/recurrence";
import type { ScheduleEvent } from "@/domain/types";
import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import type { EventFormValues } from "@/schemas/event";
import type { Session } from "@/server/auth";
import { DataError, toDataError } from "@/server/errors";

const SUBJECT_NOT_FOUND = "La materia seleccionada no existe.";

function toEvent(row: Tables<"schedule_events">): ScheduleEvent {
  return {
    id: row.id,
    subjectId: row.subject_id,
    title: row.title,
    kind: row.kind,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    location: row.location,
    notes: row.notes,
    recurrenceRule: row.recurrence_rule,
    timezone: row.timezone,
  };
}

/**
 * Convierte el formulario (hora local) en columnas de la base. En una serie
 * semanal la primera ocurrencia se mueve al primer día elegido a partir de la
 * fecha indicada, para que starts_at sea siempre una ocurrencia real.
 */
export function eventValuesToRow(
  values: EventFormValues,
  timeZone: string,
): Omit<TablesInsert<"schedule_events">, "user_id"> {
  const weekly = values.repeat === "weekly";
  const firstDate = weekly ? firstWeekdayOnOrAfter(values.date, values.repeatDays) : values.date;
  const until = weekly && values.repeatUntil !== "" ? values.repeatUntil : null;
  if (until !== null && firstDate > until) {
    throw new DataError("No hay ningún día elegido entre el inicio y el fin de la repetición.", "invalid");
  }

  const startsAt = values.allDay
    ? zonedInputToUtc(firstDate, "00:00", timeZone)
    : zonedInputToUtc(firstDate, values.startTime, timeZone);
  const endsAt = values.allDay
    ? zonedInputToUtc(addDaysToKey(firstDate, 1), "00:00", timeZone)
    : zonedInputToUtc(firstDate, values.endTime, timeZone);

  return {
    title: values.title,
    kind: values.kind,
    subject_id: values.subjectId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    all_day: values.allDay,
    location: values.location,
    notes: values.notes,
    recurrence_rule: weekly ? buildWeeklyRule(values.repeatDays, until) : null,
    timezone: timeZone,
  };
}

/** Eventos únicos que tocan [startIso, endIso) y todas las series que empiezan antes del fin. */
export async function listEventsInRange(
  session: Session,
  startIso: string,
  endIso: string,
): Promise<ScheduleEvent[]> {
  const { data, error } = await session.supabase
    .from("schedule_events")
    .select("*")
    // Valores con ":" y "." entre comillas dobles en los filtros or() de PostgREST.
    .or(
      `and(recurrence_rule.is.null,starts_at.lt."${endIso}",ends_at.gte."${startIso}"),` +
        `and(recurrence_rule.not.is.null,starts_at.lt."${endIso}")`,
    )
    .order("starts_at");
  if (error) throw toDataError(error);
  return data.map(toEvent);
}

export async function createEvent(session: Session, values: EventFormValues, timeZone: string) {
  const { data, error } = await session.supabase
    .from("schedule_events")
    .insert(eventValuesToRow(values, timeZone))
    .select("*")
    .single();
  if (error) throw toDataError(error, { "23503": SUBJECT_NOT_FOUND });
  return toEvent(data);
}

export async function updateEvent(session: Session, id: string, values: EventFormValues, timeZone: string) {
  const { data, error } = await session.supabase
    .from("schedule_events")
    .update(eventValuesToRow(values, timeZone))
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw toDataError(error, { "23503": SUBJECT_NOT_FOUND });
  if (!data) throw new DataError("No se encontró el evento.", "not_found");
  return toEvent(data);
}

/** Borra el evento y, si es una serie, todas sus repeticiones. */
export async function deleteEvent(session: Session, id: string) {
  const { data, error } = await session.supabase.from("schedule_events").delete().eq("id", id).select("id");
  if (error) throw toDataError(error);
  if (data.length === 0) throw new DataError("No se encontró el evento.", "not_found");
}
