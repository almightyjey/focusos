"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatMinutes } from "@/domain/datetime";
import type { Task } from "@/domain/types";
import { applyTaskStepsAction, suggestTaskStepsAction } from "@/server/actions/assistant";
import type { TaskStepsResult } from "@/server/services/assistant";

export function TaskStepsDialog({
  task,
  providerLabel,
  open,
  onOpenChange,
}: {
  task: Task;
  providerLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* Se monta al abrir: cada apertura empieza sin sugerencia previa. */}
        <TaskSteps
          task={task}
          providerLabel={providerLabel}
          onBusyChange={setBusy}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function TaskSteps({
  task,
  providerLabel,
  onBusyChange,
  onDone,
}: {
  task: Task;
  providerLabel: string;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const [suggestion, setSuggestion] = useState<TaskStepsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useAsEstimate, setUseAsEstimate] = useState(task.estimatedMinutes === null);
  const [generating, startGenerating] = useTransition();
  const [applying, startApplying] = useTransition();
  const total = suggestion?.steps.reduce((sum, step) => sum + step.minutes, 0) ?? 0;

  const generate = () =>
    startGenerating(async () => {
      onBusyChange(true);
      setError(null);
      const result = await suggestTaskStepsAction(task.id);
      onBusyChange(false);
      if (result.ok) setSuggestion(result.data);
      else setError(result.error);
    });

  const apply = () => {
    if (!suggestion) return;
    startApplying(async () => {
      onBusyChange(true);
      setError(null);
      const result = await applyTaskStepsAction(task.id, {
        steps: suggestion.steps,
        useAsEstimate: task.estimatedMinutes === null && useAsEstimate,
      });
      onBusyChange(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Pasos añadidos a la descripción");
      onDone();
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Dividir en pasos</DialogTitle>
        <DialogDescription>
          El asistente propone pasos para «{task.title}». Revísalos antes de añadirlos a la tarea.
        </DialogDescription>
      </DialogHeader>

      {error ? <FormAlert>{error}</FormAlert> : null}

      {suggestion ? (
        <div className="space-y-4" data-testid="task-steps-suggestion">
          <ol className="divide-y divide-rule rounded-lg border">
            {suggestion.steps.map((step, index) => (
              <li key={index} className="flex items-baseline gap-3 px-3 py-2 text-sm">
                <span className="tabular w-5 shrink-0 text-muted-foreground">{index + 1}.</span>
                <span className="min-w-0 flex-1 break-words">{step.title}</span>
                <span className="tabular shrink-0 text-xs text-muted-foreground">{formatMinutes(step.minutes)}</span>
              </li>
            ))}
          </ol>
          <p className="tabular text-sm">Total: {formatMinutes(total)}</p>
          {suggestion.notes ? <p className="text-sm text-muted-foreground">{suggestion.notes}</p> : null}
          {task.estimatedMinutes === null ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="steps-estimate"
                checked={useAsEstimate}
                onCheckedChange={(value) => setUseAsEstimate(value === true)}
              />
              <Label htmlFor="steps-estimate">Usar {formatMinutes(total)} como estimación de la tarea</Label>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">Sugerencia de {suggestion.providerLabel}. Puede equivocarse.</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Se enviarán el título, el tipo, la materia, la fecha límite, la estimación y la descripción de esta tarea a{" "}
          {providerLabel}. No se guarda nada hasta que lo confirmes.
        </p>
      )}

      <DialogFooter>
        {suggestion ? (
          <>
            <Button variant="outline" onClick={generate} disabled={generating || applying}>
              {generating ? "Generando…" : "Otra sugerencia"}
            </Button>
            <Button onClick={apply} disabled={generating || applying}>
              {applying ? "Añadiendo…" : "Añadir a la descripción"}
            </Button>
          </>
        ) : (
          <Button onClick={generate} disabled={generating}>
            {generating ? "Generando…" : error ? "Reintentar" : "Generar sugerencia"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
