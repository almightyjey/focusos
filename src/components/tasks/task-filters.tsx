"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import type { SubjectOption } from "@/components/tasks/task-form-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ALL = "all";

export function TaskFilters({
  view,
  subjectId,
  subjects,
}: {
  view: "open" | "completed";
  subjectId?: string;
  subjects: SubjectOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefFor = (params: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(params)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const views = [
    { value: "open", label: "Pendientes" },
    { value: "completed", label: "Completadas" },
  ] as const;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav aria-label="Estado de las tareas" className="inline-flex w-fit rounded-lg bg-muted p-1">
        {views.map((option) => {
          const active = option.value === view;
          return (
            <Link
              key={option.value}
              href={hrefFor({ view: option.value === "open" ? undefined : option.value })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active && "bg-background text-foreground shadow-xs",
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>

      {subjects.length > 0 ? (
        <div className="sm:w-72">
          <label htmlFor="task-subject-filter" className="sr-only">
            Filtrar por materia
          </label>
          <Select
            value={subjectId ?? ALL}
            onValueChange={(value) => router.push(hrefFor({ subject: value === ALL ? undefined : value }))}
          >
            <SelectTrigger id="task-subject-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las materias</SelectItem>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  <SubjectSwatch color={subject.color} />
                  {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
