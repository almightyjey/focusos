import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { NewEventButton } from "@/components/calendar/calendar-items";
import { Button } from "@/components/ui/button";
import { shiftAnchor, type CalendarView } from "@/domain/calendar";
import { cn } from "@/lib/utils";

const hrefFor = (view: CalendarView, date: string) => `/calendar?view=${view}&date=${date}`;

export function CalendarToolbar({
  view,
  anchorKey,
  todayKey,
  title,
}: {
  view: CalendarView;
  anchorKey: string;
  todayKey: string;
  title: string;
}) {
  const unit = view === "week" ? "Semana" : "Mes";
  const views = [
    { value: "week", label: "Semana" },
    { value: "month", label: "Mes" },
  ] as const;

  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon">
            <Link href={hrefFor(view, shiftAnchor(view, anchorKey, -1))} aria-label={`${unit} anterior`}>
              <ChevronLeftIcon aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon">
            <Link href={hrefFor(view, shiftAnchor(view, anchorKey, 1))} aria-label={`${unit} siguiente`}>
              <ChevronRightIcon aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={hrefFor(view, todayKey)} aria-label="Ir a hoy">
              Hoy
            </Link>
          </Button>
        </div>
        <h2 className="text-base font-semibold tracking-tight" aria-live="polite">
          {title}
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Vista del calendario" className="inline-flex w-fit rounded-lg bg-muted p-1">
          {views.map((option) => {
            const active = option.value === view;
            return (
              <Link
                key={option.value}
                href={hrefFor(option.value, anchorKey)}
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
        <NewEventButton dateKey={anchorKey} />
      </div>
    </div>
  );
}
