import { cn } from "@/lib/utils";

/** Pestaña de color de la materia, como las de un cuaderno con separadores. */
export function SubjectSwatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-[3px]", className)}
      style={{ backgroundColor: color }}
    />
  );
}
