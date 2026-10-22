import { Skeleton } from "@/components/ui/skeleton";

export function ListSkeleton({ rows = 5, label = "Cargando…" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <Skeleton className="h-9 w-64" />
      <div className="divide-y divide-rule">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-start gap-3 py-3">
            <Skeleton className="size-5 rounded-[4px]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
