"use client";

import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import type { SubjectOption } from "@/components/tasks/task-form-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NONE } from "@/schemas/common";

export type TaskOption = { id: string; title: string; subjectId: string | null };

/** Qué se va a estudiar: una tarea abierta, una materia en general o nada en concreto. */
export function SessionTargetSelect({
  id,
  value,
  onChange,
  tasks,
  subjects,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  tasks: TaskOption[];
  subjects: SubjectOption[];
  invalid?: boolean;
}) {
  const color = (subjectId: string | null) => subjects.find((s) => s.id === subjectId)?.color;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {tasks.length > 0 ? (
          <SelectGroup>
            <SelectLabel>Tareas pendientes</SelectLabel>
            {tasks.map((task) => (
              <SelectItem key={task.id} value={`task:${task.id}`}>
                {color(task.subjectId) ? <SubjectSwatch color={color(task.subjectId)!} /> : null}
                {task.title}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
        {subjects.length > 0 ? (
          <>
            {tasks.length > 0 ? <SelectSeparator /> : null}
            <SelectGroup>
              <SelectLabel>Repaso general de una materia</SelectLabel>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={`subject:${subject.id}`}>
                  <SubjectSwatch color={subject.color} />
                  {subject.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        ) : null}
        <SelectSeparator />
        <SelectItem value={NONE}>Sin tarea ni materia</SelectItem>
      </SelectContent>
    </Select>
  );
}
