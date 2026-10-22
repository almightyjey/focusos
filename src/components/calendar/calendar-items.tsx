"use client";

import { CheckIcon, PlusIcon, RepeatIcon } from "lucide-react";
import type { CSSProperties } from "react";

import { useCalendarActions } from "@/components/calendar/calendar-provider";
import { Button } from "@/components/ui/button";
import { EVENT_KIND_LABELS } from "@/domain/labels";
import type { EventOccurrence } from "@/domain/events";
import type { Task } from "@/domain/types";
import { cn } from "@/lib/utils";

const NEUTRAL = "var(--muted-foreground)";

function timeLabel(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function eventTimeRange(occurrence: EventOccurrence, timeZone: string) {
  if (occurrence.allDay) return "Todo el día";
  return `${timeLabel(occurrence.startsAt, timeZone)} a ${timeLabel(occurrence.endsAt, timeZone)}`;
}

/** Color de la materia como variable CSS para fondos y bordes tintados. */
function tint(color: string | undefined): CSSProperties {
  return { "--item": color ?? NEUTRAL } as CSSProperties;
}

const tinted =
  "border-l-[3px] border-[var(--item)] bg-[color-mix(in_oklch,var(--item)_13%,var(--card))] text-foreground hover:bg-[color-mix(in_oklch,var(--item)_22%,var(--card))]";

export function EventItem({
  occurrence,
  color,
  subjectName,
  timeZone,
  variant,
  style,
}: {
  occurrence: EventOccurrence;
  color?: string;
  subjectName?: string;
  timeZone: string;
  /** block: rejilla horaria · chip: celda del mes o fila de todo el día · row: agenda */
  variant: "block" | "chip" | "row";
  style?: CSSProperties;
}) {
  const { editEvent } = useCalendarActions();
  const kind = EVENT_KIND_LABELS[occurrence.kind];
  const range = eventTimeRange(occurrence, timeZone);
  const label = `${kind}: ${occurrence.title}, ${range}${occurrence.location ? `, ${occurrence.location}` : ""}`;
  const isExam = occurrence.kind === "exam";

  return (
    <button
      type="button"
      onClick={() => editEvent(occurrence.eventId)}
      aria-label={label}
      data-testid="calendar-event"
      data-event-title={occurrence.title}
      style={{ ...tint(color), ...style }}
      className={cn(
        "rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        tinted,
        variant === "block" && "absolute overflow-hidden px-2 py-1 text-xs leading-tight",
        variant === "chip" && "block w-full truncate px-1.5 py-0.5 text-xs",
        variant === "row" && "flex w-full items-start gap-3 px-3 py-2.5",
      )}
    >
      {variant === "row" ? (
        <>
          <span className="tabular w-24 shrink-0 pt-0.5 text-xs text-muted-foreground">{range}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{occurrence.title}</span>
            <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              <span className={cn(isExam && "font-semibold text-foreground")}>{kind}</span>
              {subjectName ? <span className="truncate">{subjectName}</span> : null}
              {occurrence.location ? <span>{occurrence.location}</span> : null}
            </span>
          </span>
          {occurrence.recurring ? <RepeatIcon className="mt-0.5 size-3.5 text-muted-foreground" aria-hidden /> : null}
        </>
      ) : variant === "block" ? (
        <>
          <span className="block truncate font-medium">{occurrence.title}</span>
          <span className="tabular block truncate text-muted-foreground">
            {isExam ? <span className="font-semibold text-foreground">Examen </span> : null}
            {range}
          </span>
          {occurrence.location ? (
            <span className="block truncate text-muted-foreground">{occurrence.location}</span>
          ) : null}
        </>
      ) : (
        <>
          {!occurrence.allDay ? (
            <span className="tabular mr-1 text-muted-foreground">{timeLabel(occurrence.startsAt, timeZone)}</span>
          ) : null}
          {isExam ? <span className="font-semibold">Examen: </span> : null}
          {occurrence.title}
        </>
      )}
    </button>
  );
}

export function TaskItemButton({
  task,
  subjectName,
  color,
  timeZone,
  variant,
}: {
  task: Task;
  subjectName?: string;
  color?: string;
  timeZone: string;
  variant: "chip" | "row";
}) {
  const { editTask } = useCalendarActions();
  const done = task.status === "completed";
  const due = task.dueAt ? timeLabel(task.dueAt, timeZone) : "";

  return (
    <button
      type="button"
      onClick={() => editTask(task.id)}
      aria-label={`Entrega: ${task.title}${due ? `, vence a las ${due}` : ""}${done ? ", completada" : ""}`}
      data-testid="calendar-task"
      data-task-title={task.title}
      style={tint(color)}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md border border-dashed border-[var(--item)] text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
        variant === "chip" && "px-1.5 py-0.5 text-xs",
        variant === "row" && "gap-3 px-3 py-2.5",
      )}
    >
      {variant === "row" ? (
        <>
          <span className="tabular w-24 shrink-0 text-xs text-muted-foreground">Entrega {due}</span>
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-sm font-medium", done && "text-muted-foreground line-through")}>
              {task.title}
            </span>
            {subjectName ? <span className="block truncate text-xs text-muted-foreground">{subjectName}</span> : null}
          </span>
          {done ? <CheckIcon className="size-4 text-muted-foreground" aria-hidden /> : null}
        </>
      ) : (
        <>
          <span
            aria-hidden
            className={cn(
              "inline-flex size-3 shrink-0 items-center justify-center rounded-[3px] border border-current text-muted-foreground",
              done && "bg-muted-foreground text-background",
            )}
          >
            {done ? <CheckIcon className="size-2.5" strokeWidth={3} /> : null}
          </span>
          <span className={cn("truncate", done && "text-muted-foreground line-through")}>{task.title}</span>
        </>
      )}
    </button>
  );
}

export function NewEventButton({ dateKey, label = "Nuevo evento" }: { dateKey: string; label?: string }) {
  const { newEvent } = useCalendarActions();
  return (
    <Button onClick={() => newEvent(dateKey)}>
      <PlusIcon aria-hidden /> {label}
    </Button>
  );
}

export function AddOnDayButton({ dateKey, dayLabel }: { dateKey: string; dayLabel: string }) {
  const { newEvent } = useCalendarActions();
  return (
    <Button variant="ghost" size="icon-xs" onClick={() => newEvent(dateKey)} aria-label={`Añadir evento el ${dayLabel}`}>
      <PlusIcon aria-hidden />
    </Button>
  );
}
