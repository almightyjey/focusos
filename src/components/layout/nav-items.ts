import {
  BookOpenIcon,
  CalendarDaysIcon,
  ListChecksIcon,
  SettingsIcon,
  SunIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

// Solo secciones que ya existen; sesiones y calificaciones se añaden cuando
// se implementen sus fases.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Hoy", icon: SunIcon },
  { href: "/tasks", label: "Tareas", icon: ListChecksIcon },
  { href: "/calendar", label: "Calendario", icon: CalendarDaysIcon },
  { href: "/subjects", label: "Materias", icon: BookOpenIcon },
  { href: "/settings", label: "Ajustes", icon: SettingsIcon },
];
