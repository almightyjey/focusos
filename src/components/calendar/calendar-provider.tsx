"use client";

import { createContext, use, useState, type ReactNode } from "react";

import { EventFormDialog } from "@/components/calendar/event-form-dialog";
import { TaskFormDialog, type SubjectOption } from "@/components/tasks/task-form-dialog";
import type { ScheduleEvent, Task } from "@/domain/types";

type DialogState =
  | { mode: "closed" }
  | { mode: "new-event"; dateKey: string }
  | { mode: "edit-event"; eventId: string }
  | { mode: "edit-task"; taskId: string };

type CalendarActions = {
  newEvent: (dateKey: string) => void;
  editEvent: (eventId: string) => void;
  editTask: (taskId: string) => void;
};

const CalendarContext = createContext<CalendarActions | null>(null);

export function useCalendarActions(): CalendarActions {
  const context = use(CalendarContext);
  if (!context) throw new Error("useCalendarActions debe usarse dentro de CalendarProvider");
  return context;
}

/**
 * Un solo diálogo de evento y uno de tarea para todo el calendario: cada
 * elemento solo pide abrirlos, en lugar de montar su propio diálogo.
 */
export function CalendarProvider({
  events,
  tasks,
  subjects,
  timeZone,
  weekStartsOn,
  nowIso,
  defaultDateKey,
  children,
}: {
  events: ScheduleEvent[];
  tasks: Task[];
  subjects: SubjectOption[];
  timeZone: string;
  weekStartsOn: number;
  nowIso: string;
  defaultDateKey: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<DialogState>({ mode: "closed" });
  const [dialogKey, setDialogKey] = useState(0);
  const close = () => setState({ mode: "closed" });
  const openWith = (next: DialogState) => {
    setDialogKey((key) => key + 1);
    setState(next);
  };

  const actions: CalendarActions = {
    newEvent: (dateKey) => openWith({ mode: "new-event", dateKey }),
    editEvent: (eventId) => openWith({ mode: "edit-event", eventId }),
    editTask: (taskId) => openWith({ mode: "edit-task", taskId }),
  };

  const editingEvent = state.mode === "edit-event" ? events.find((e) => e.id === state.eventId) : undefined;
  const editingTask = state.mode === "edit-task" ? tasks.find((t) => t.id === state.taskId) : undefined;

  return (
    <CalendarContext value={actions}>
      {children}
      <EventFormDialog
        key={`event-${dialogKey}`}
        open={state.mode === "new-event" || Boolean(editingEvent)}
        onOpenChange={(open) => !open && close()}
        event={editingEvent}
        dateKey={state.mode === "new-event" ? state.dateKey : defaultDateKey}
        subjects={subjects}
        timeZone={timeZone}
        weekStartsOn={weekStartsOn}
      />
      {editingTask ? (
        <TaskFormDialog
          key={`task-${dialogKey}`}
          task={editingTask}
          subjects={subjects}
          timeZone={timeZone}
          nowIso={nowIso}
          open
          onOpenChange={(open) => !open && close()}
        />
      ) : null}
    </CalendarContext>
  );
}
