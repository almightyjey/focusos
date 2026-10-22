import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-dashed px-5 py-8 text-center", className)}>
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
      ) : null}
      {actions ? <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
