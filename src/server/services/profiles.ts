import "server-only";

import { cache } from "react";

import { DEFAULT_STUDY_WINDOW, DEFAULT_TIMEZONE } from "@/domain/datetime";
import type { Profile } from "@/domain/types";
import type { Tables } from "@/lib/supabase/database.types";
import type { ProfileFormValues } from "@/schemas/profile";
import type { Session } from "@/server/auth";
import { DataError, toDataError } from "@/server/errors";

function toProfile(row: Tables<"profiles">): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    timezone: row.timezone,
    weekStartsOn: row.week_starts_on,
    studyWindow: { start: row.study_window_start, end: row.study_window_end },
  };
}

/** Perfil del usuario actual. Una sola consulta por petición. */
export const getProfile = cache(async (session: Session): Promise<Profile> => {
  const { data, error } = await session.supabase
    .from("profiles")
    .select("*")
    .eq("id", session.userId)
    .maybeSingle();
  if (error) throw toDataError(error);
  // El trigger de registro crea el perfil; si faltara, se usan valores por defecto.
  return data
    ? toProfile(data)
    : {
        id: session.userId,
        displayName: null,
        timezone: DEFAULT_TIMEZONE,
        weekStartsOn: 1,
        studyWindow: DEFAULT_STUDY_WINDOW,
      };
});

export async function updateProfile(session: Session, values: ProfileFormValues): Promise<Profile> {
  const { data, error } = await session.supabase
    .from("profiles")
    .update({
      display_name: values.displayName,
      timezone: values.timezone,
      week_starts_on: values.weekStartsOn,
      study_window_start: values.studyStart,
      study_window_end: values.studyEnd,
    })
    .eq("id", session.userId)
    .select("*")
    .maybeSingle();
  if (error) throw toDataError(error, { "22023": "Zona horaria no válida." });
  if (!data) throw new DataError("No se encontró tu perfil.", "not_found");
  return toProfile(data);
}
