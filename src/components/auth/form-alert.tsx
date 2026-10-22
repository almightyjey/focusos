import { cn } from "@/lib/utils";

export function FormAlert({
  children,
  tone = "error",
  className,
}: {
  children: React.ReactNode;
  tone?: "error" | "info";
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2.5 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-primary/20 bg-accent text-accent-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
