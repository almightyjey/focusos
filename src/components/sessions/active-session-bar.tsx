import { SessionBar } from "@/components/sessions/active-timer";
import { requireSession } from "@/server/auth";
import { getActiveSession } from "@/server/services/sessions";

/** Muestra el temporizador en todas las páginas mientras haya una sesión en curso. */
export async function ActiveSessionBar() {
  const session = await requireSession();
  const active = await getActiveSession(session);
  if (!active) return null;
  return <SessionBar session={active} serverNowIso={new Date().toISOString()} />;
}
