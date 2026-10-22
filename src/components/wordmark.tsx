import Link from "next/link";

import { cn } from "@/lib/utils";

/** Logotipo: un trazo de resaltador bajo el nombre. */
export function Wordmark({ className, href = "/dashboard" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center rounded-md text-[1.05rem] font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span className="relative">
        <span
          aria-hidden
          className="absolute inset-x-[-0.2em] bottom-[0.08em] h-[0.42em] rounded-[0.15em_0.3em_0.2em_0.35em] bg-highlight/80"
        />
        <span className="relative">FocusOS</span>
      </span>
    </Link>
  );
}
