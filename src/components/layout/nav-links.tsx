"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { NAV_ITEMS } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

function activeHrefFor(pathname: string): string | null {
  return NAV_ITEMS.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`))?.href ?? null;
}

function SidebarNavList({ activeHref }: { activeHref: string | null }) {
  return (
    <nav aria-label="Principal" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === activeHref;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
              active && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function BottomNavList({ activeHref }: { activeHref: string | null }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {NAV_ITEMS.filter((item) => item.mobile).map(({ href, label, icon: Icon }) => {
          const active = href === activeHref;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[0.68rem] font-medium text-muted-foreground outline-none focus-visible:bg-muted",
                  active && "text-primary",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ActiveSidebarNav() {
  return <SidebarNavList activeHref={activeHrefFor(usePathname())} />;
}

function ActiveBottomNav() {
  return <BottomNavList activeHref={activeHrefFor(usePathname())} />;
}

/*
 * La ruta actual solo se conoce al pedir la página (p. ej. /subjects/[id]), así
 * que el resaltado va dentro de Suspense: el shell estático muestra los mismos
 * enlaces sin marcar y se completa al llegar la URL.
 */
export function SidebarNav() {
  return (
    <Suspense fallback={<SidebarNavList activeHref={null} />}>
      <ActiveSidebarNav />
    </Suspense>
  );
}

export function BottomNav() {
  return (
    <Suspense fallback={<BottomNavList activeHref={null} />}>
      <ActiveBottomNav />
    </Suspense>
  );
}
