import { SectionHeading } from "@/components/page-header";
import { Progress } from "@/components/ui/progress";
import { formatDayHeading } from "@/domain/datetime";
import type { WeeklyProgress } from "@/domain/tasks";

export function WeekProgress({ progress }: { progress: WeeklyProgress }) {
  const { dueThisWeek, dueThisWeekCompleted, completedThisWeek } = progress;
  const percent = dueThisWeek === 0 ? 0 : Math.round((dueThisWeekCompleted / dueThisWeek) * 100);

  return (
    <section aria-labelledby="week-heading">
      <SectionHeading
        id="week-heading"
        title="Esta semana"
        meta={
          <span>
            {formatDayHeading(progress.weekStartKey)} a {formatDayHeading(progress.weekEndKey).toLowerCase()}
          </span>
        }
      />
      {dueThisWeek === 0 ? (
        <p className="text-sm text-muted-foreground">No hay entregas con fecha en esta semana.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm">
            <span className="tabular text-2xl font-semibold tracking-tight">{dueThisWeekCompleted}</span>
            <span className="text-muted-foreground"> de </span>
            <span className="tabular font-medium">{dueThisWeek}</span>
            <span className="text-muted-foreground"> entregas de la semana completadas</span>
          </p>
          <Progress value={percent} aria-label={`${percent}% de las entregas de la semana completadas`} />
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {completedThisWeek === 1
          ? "1 tarea completada en total esta semana."
          : `${completedThisWeek} tareas completadas en total esta semana.`}
      </p>
    </section>
  );
}
