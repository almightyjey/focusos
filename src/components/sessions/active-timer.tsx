"use client";

import { PauseIcon, PlayIcon, SquareIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { FinishSessionDialog } from "@/components/sessions/finish-session-dialog";
import { useNow } from "@/components/sessions/use-now";
import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { focusSecondsAt, formatClock, remainingSeconds, type SessionWithTask } from "@/domain/sessions";
import { cn } from "@/lib/utils";
import { cancelSessionAction, pauseSessionAction, resumeSessionAction } from "@/server/actions/sessions";

function sessionLabel(session: SessionWithTask) {
  return session.taskTitle ?? (session.subjectName ? `Repaso de ${session.subjectName}` : "Estudio libre");
}

/**
 * Temporizador de la sesión activa. Todo se calcula a partir de las marcas de
 * tiempo guardadas en la base; el reloj del navegador solo sirve para mostrar.
 */
export function ActiveTimer({
  session,
  serverNowIso,
  variant,
}: {
  session: SessionWithTask;
  serverNowIso: string;
  variant: "full" | "bar";
}) {
  const now = useNow(Date.parse(serverNowIso));
  const [pending, startTransition] = useTransition();
  const [finishing, setFinishing] = useState<number | null>(null);
  const [discarding, setDiscarding] = useState(false);

  const paused = session.pausedAt !== null;
  const focus = focusSecondsAt(session, now);
  const remaining = remainingSeconds(session, now);
  const overtime = remaining !== null && remaining < 0;
  const clock = remaining === null ? formatClock(focus) : formatClock(remaining);
  const label = sessionLabel(session);
  const status = paused ? "En pausa" : overtime ? "Tiempo extra" : remaining === null ? "Estudiando" : "Quedan";

  // Aviso único al cumplir el objetivo, programado desde las marcas de tiempo.
  useEffect(() => {
    if (paused || session.plannedMinutes === null) return;
    const ms = (remainingSeconds(session, Date.now()) ?? 0) * 1000;
    if (ms <= 0) return;
    const timeout = setTimeout(() => toast.info("Cumpliste el tiempo de la sesión. Termínala o sigue un poco más."), ms);
    return () => clearTimeout(timeout);
  }, [session, paused]);

  // El título de la pestaña muestra el reloj mientras hay una sesión.
  useEffect(() => {
    const previous = document.title;
    return () => {
      document.title = previous;
    };
  }, []);
  // Se reaplica en cada tic: Next fija el título de la página al navegar y,
  // en pausa, el reloj no cambia.
  useEffect(() => {
    document.title = `${overtime ? "+" : ""}${clock} ${paused ? "en pausa" : label} | FocusOS`;
  }, [now, clock, overtime, paused, label]);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok && result.error) toast.error(result.error);
    });

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      {paused ? (
        <Button
          size={variant === "full" ? "lg" : "sm"}
          disabled={pending}
          onClick={() => run(() => resumeSessionAction(session.id))}
        >
          <PlayIcon aria-hidden /> Reanudar
        </Button>
      ) : (
        <Button
          size={variant === "full" ? "lg" : "sm"}
          variant="outline"
          disabled={pending}
          onClick={() => run(() => pauseSessionAction(session.id))}
        >
          <PauseIcon aria-hidden /> Pausar
        </Button>
      )}
      <Button
        size={variant === "full" ? "lg" : "sm"}
        variant={paused ? "outline" : "default"}
        disabled={pending}
        // Los minutos medidos se fijan al abrir para que el formulario no cambie mientras se edita.
        onClick={() => setFinishing(Math.floor(focusSecondsAt(session, Date.now()) / 60))}
      >
        <SquareIcon aria-hidden /> Terminar
      </Button>
      <Button
        size={variant === "full" ? "lg" : "sm"}
        variant="ghost"
        disabled={pending}
        onClick={() => setDiscarding(true)}
        aria-label="Descartar sesión"
      >
        <XIcon aria-hidden />
        {variant === "full" ? "Descartar" : null}
      </Button>
    </div>
  );

  const dialogs = (
    <>
      <FinishSessionDialog
        open={finishing !== null}
        onOpenChange={(open) => !open && setFinishing(null)}
        sessionId={session.id}
        taskTitle={session.taskTitle}
        measuredMinutes={finishing ?? 0}
      />
      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title="¿Descartar esta sesión?"
        description="No se registrará el tiempo de esta sesión."
        confirmLabel="Descartar sesión"
        pendingLabel="Descartando…"
        successMessage="Sesión descartada"
        onConfirm={() => cancelSessionAction(session.id)}
      />
    </>
  );

  if (variant === "bar") {
    return (
      <div
        role="region"
        aria-label="Sesión de estudio en curso"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-card px-4 py-2 sm:px-6 md:px-10"
      >
        <Link href="/study" className="flex min-w-0 items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span
            className={cn(
              "tabular text-lg font-semibold tracking-tight",
              overtime && "text-destructive",
              paused && "text-muted-foreground",
            )}
            data-testid="session-clock"
          >
            {overtime ? "+" : ""}
            {clock}
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">{status}</span>
            <span className="block truncate text-sm font-medium">{label}</span>
          </span>
        </Link>
        {controls}
        {dialogs}
      </div>
    );
  }

  const progress =
    session.plannedMinutes === null ? null : Math.min(100, (focus / (session.plannedMinutes * 60)) * 100);

  return (
    <section aria-labelledby="active-heading" className="rounded-xl border bg-card p-5 sm:p-6">
      <h2 id="active-heading" className="sr-only">
        Sesión en curso
      </h2>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {session.subjectColor ? <SubjectSwatch color={session.subjectColor} /> : null}
        <span className="truncate">{session.subjectName ?? "Sin materia"}</span>
      </p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{label}</p>
      <div className="my-6">
        <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
          {status}
        </p>
        <p
          className={cn(
            "tabular text-6xl font-semibold tracking-tight sm:text-7xl",
            overtime && "text-destructive",
            paused && "text-muted-foreground",
          )}
          data-testid="session-clock"
        >
          {overtime ? "+" : ""}
          {clock}
        </p>
        {progress !== null ? (
          <Progress value={progress} className="mt-4 max-w-md" aria-label={`${Math.round(progress)}% del objetivo`} />
        ) : null}
        <p className="tabular mt-2 text-sm text-muted-foreground">
          {formatClock(focus)} de enfoque
          {session.plannedMinutes !== null ? ` de ${session.plannedMinutes} min` : ""}
        </p>
      </div>
      {controls}
      {dialogs}
    </section>
  );
}

/** Barra global: se oculta en /study, donde el temporizador grande ya está visible. */
export function SessionBar(props: { session: SessionWithTask; serverNowIso: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/study")) return null;
  return <ActiveTimer {...props} variant="bar" />;
}
