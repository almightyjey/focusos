import { Suspense, type ReactNode } from "react";

import { BottomNav, SidebarNav } from "@/components/layout/nav-links";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { Wordmark } from "@/components/wordmark";
import { requireSession } from "@/server/auth";
import { getProfile } from "@/server/services/profiles";

async function CurrentUserMenu({ showName }: { showName?: boolean }) {
  const session = await requireSession();
  const profile = await getProfile(session);
  return <UserMenu displayName={profile.displayName} email={session.email} showName={showName} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-sidebar px-3 py-5 md:flex">
        <div className="px-3 pb-6">
          <Wordmark />
        </div>
        <SidebarNav />
        <div className="mt-auto flex items-center gap-1 border-t pt-3">
          <div className="min-w-0 flex-1">
            <Suspense fallback={<Skeleton className="h-10 w-full" />}>
              <CurrentUserMenu showName />
            </Suspense>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <Wordmark />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Suspense fallback={<Skeleton className="size-9 rounded-full" />}>
              <CurrentUserMenu />
            </Suspense>
          </div>
        </header>

        <main id="contenido" tabIndex={-1} className="flex-1 px-4 pt-6 pb-28 outline-none sm:px-6 md:px-10 md:pt-10 md:pb-12">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
