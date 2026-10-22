import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{title}</h1>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Encabezado de sección: título con línea de cuaderno debajo. */
export function SectionHeading({
  id,
  title,
  meta,
  action,
}: {
  id?: string;
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-rule pb-2">
      <h2 id={id} className="text-sm font-semibold">
        {title}
      </h2>
      <div className="flex items-baseline gap-3 text-xs text-muted-foreground">
        {meta}
        {action}
      </div>
    </div>
  );
}
