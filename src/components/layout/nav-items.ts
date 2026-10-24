import {
  BookOpenIcon,
  CalendarDaysIcon,
  GraduationCapIcon,
  ListChecksIcon,
  ListOrderedIcon,
  SettingsIcon,
  SunIcon,
  TimerIcon,
  type LucideIcon,
} from "lucide-react";

/** `mobile: false` lo deja fuera de la barra inferior (sigue en el menú de la cuenta). */
export type NavItem = { href: string; label: string; icon: LucideIcon; mobile: boolean };

// En móvil, Plan se abre desde Hoy, Calificaciones desde cada materia y Ajustes desde el menú de la cuenta.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Hoy", icon: SunIcon, mobile: true },
  { href: "/plan", label: "Plan", icon: ListOrderedIcon, mobile: false },
  { href: "/tasks", label: "Tareas", icon: ListChecksIcon, mobile: true },
  { href: "/study", label: "Estudio", icon: TimerIcon, mobile: true },
  { href: "/calendar", label: "Calendario", icon: CalendarDaysIcon, mobile: true },
  { href: "/subjects", label: "Materias", icon: BookOpenIcon, mobile: true },
  { href: "/grades", label: "Calificaciones", icon: GraduationCapIcon, mobile: false },
  { href: "/settings", label: "Ajustes", icon: SettingsIcon, mobile: false },
];
