import { AssistantBoundary } from "@/components/assistant/assistant-boundary";
import { SectionHeading } from "@/components/page-header";
import { TaskItem } from "@/components/tasks/task-item";
import type { SubjectOption } from "@/components/tasks/task-form-dialog";
import type { Task } from "@/domain/types";

export function TaskSection({
  id,
  title,
  tasks,
  subjects,
  nowIso,
  timeZone,
  showSubject = true,
}: {
  id: string;
  title: string;
  tasks: Task[];
  subjects: SubjectOption[];
  nowIso: string;
  timeZone: string;
  showSubject?: boolean;
}) {
  return (
    <section aria-labelledby={id}>
      <SectionHeading id={id} title={title} meta={<span className="tabular">{tasks.length}</span>} />
      <ul className="divide-y divide-rule">
        <AssistantBoundary>
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              subjects={subjects}
              nowIso={nowIso}
              timeZone={timeZone}
              showSubject={showSubject}
            />
          ))}
        </AssistantBoundary>
      </ul>
    </section>
  );
}
