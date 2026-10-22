import { dayKey, formatDueLabel } from "@/domain/datetime";
import { cn } from "@/lib/utils";

/**
 * Fecha límite en la zona del usuario. Lo que vence hoy lleva el resaltador;
 * lo vencido, color de alerta. `now` llega del servidor para que el texto sea
 * idéntico al hidratar.
 */
export function DueLabel({
  dueAt,
  nowIso,
  timeZone,
  done = false,
  highlight = true,
  className,
}: {
  dueAt: string;
  nowIso: string;
  timeZone: string;
  done?: boolean;
  /** El resaltador se reserva para las listas de trabajo, no para resúmenes. */
  highlight?: boolean;
  className?: string;
}) {
  const now = new Date(nowIso);
  const label = formatDueLabel(dueAt, now, timeZone);
  const overdue = !done && Date.parse(dueAt) < now.getTime();
  const today = !done && !overdue && dayKey(dueAt, timeZone) === dayKey(now, timeZone);

  return (
    <time
      dateTime={dueAt}
      className={cn(
        "text-xs whitespace-nowrap text-muted-foreground",
        overdue && "font-medium text-destructive",
        today && (highlight ? "highlighter font-medium" : "font-medium text-foreground"),
        className,
      )}
    >
      {overdue ? `Venció ${label.charAt(0).toLowerCase()}${label.slice(1)}` : label}
    </time>
  );
}
