"use client";

import { LogOutIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/server/actions/auth";

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email || "?";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (name ? (parts[1]?.[0] ?? "") : "")).toUpperCase();
}

export function UserMenu({
  displayName,
  email,
  showName = false,
}: {
  displayName: string | null;
  email: string | null;
  showName?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={showName ? "h-10 w-full justify-start gap-2.5 px-2" : "size-9 rounded-full p-0"}
          aria-label="Menú de la cuenta"
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
              {initials(displayName, email)}
            </AvatarFallback>
          </Avatar>
          {showName ? (
            <span className="min-w-0 truncate text-sm font-medium">{displayName || email}</span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-medium text-foreground">{displayName || "Tu cuenta"}</span>
          {email ? <span className="block truncate text-xs text-muted-foreground">{email}</span> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon aria-hidden /> Ajustes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
            startTransition(() => signOutAction());
          }}
        >
          <LogOutIcon aria-hidden /> {pending ? "Cerrando sesión…" : "Cerrar sesión"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
