import type { Metadata } from "next";
import { Suspense } from "react";

import { IntegrationsSection, type IntegrationNotice } from "@/components/integrations/integrations-section";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLongDate, utcToZonedInput } from "@/domain/datetime";
import { requireSession } from "@/server/auth";
import { getIntegrationsOverview } from "@/server/services/integrations";
import { getProfile } from "@/server/services/profiles";
import { listSubjects } from "@/server/services/subjects";

export const metadata: Metadata = { title: "Ajustes" };

/** Resultado del OAuth de Notion (?notion=...), que deja el route handler de vuelta. */
const NOTION_NOTICES: Record<string, NonNullable<IntegrationNotice>> = {
  connected: { tone: "info", message: "Notion quedó conectado. Ahora elige qué base importar." },
  denied: { tone: "info", message: "Cancelaste la conexión con Notion. No se cambió nada." },
  error: { tone: "error", message: "No se pudo conectar con Notion. Inténtalo de nuevo." },
  state: { tone: "error", message: "No se pudo verificar la conexión con Notion. Vuelve a intentarlo." },
  not_configured: { tone: "error", message: "Notion no está configurado en el servidor." },
};

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <>
      <PageHeader title="Ajustes" description="Tu perfil, tu horario de estudio y las integraciones opcionales." />
      <Suspense fallback={<Skeleton className="h-80 w-full max-w-lg" />}>
        <SettingsContent />
      </Suspense>
      <section aria-labelledby="integraciones" className="mt-12 max-w-2xl">
        <SectionHeading id="integraciones" title="Integraciones" />
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <IntegrationsContent searchParams={searchParams} />
        </Suspense>
      </section>
    </>
  );
}

async function SettingsContent() {
  const session = await requireSession();
  const profile = await getProfile(session);
  const zones = Intl.supportedValuesOf("timeZone");
  const timeZones = zones.includes(profile.timezone) ? zones : [profile.timezone, ...zones];
  return <ProfileForm profile={profile} email={session.email} timeZones={timeZones} />;
}

async function IntegrationsContent({ searchParams }: { searchParams: PageProps<"/settings">["searchParams"] }) {
  const session = await requireSession();
  const [overview, subjects, profile, params] = await Promise.all([
    getIntegrationsOverview(session),
    listSubjects(session),
    getProfile(session),
    searchParams,
  ]);
  const synced = overview.notion.lastSyncedAt;
  const notionParam = typeof params.notion === "string" ? params.notion : null;
  return (
    <IntegrationsSection
      assistant={overview.assistant}
      notion={overview.notion}
      problems={overview.problems}
      subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name, color: subject.color }))}
      lastSyncedLabel={
        synced
          ? `${formatLongDate(new Date(synced), profile.timezone)}, ${utcToZonedInput(synced, profile.timezone).time}`
          : null
      }
      notice={notionParam ? (NOTION_NOTICES[notionParam] ?? null) : null}
    />
  );
}
