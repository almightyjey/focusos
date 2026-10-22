"use client";

import { PlusIcon } from "lucide-react";

import { TaskFormDialog, type SubjectOption } from "@/components/tasks/task-form-dialog";
import { Button } from "@/components/ui/button";

export function NewTaskButton({
  subjects,
  timeZone,
  nowIso,
  defaultSubjectId,
  variant = "default",
}: {
  subjects: SubjectOption[];
  timeZone: string;
  nowIso: string;
  defaultSubjectId?: string;
  variant?: "default" | "outline";
}) {
  return (
    <TaskFormDialog
      subjects={subjects}
      timeZone={timeZone}
      nowIso={nowIso}
      defaultSubjectId={defaultSubjectId}
      trigger={
        <Button variant={variant}>
          <PlusIcon aria-hidden /> Nueva tarea
        </Button>
      }
    />
  );
}
