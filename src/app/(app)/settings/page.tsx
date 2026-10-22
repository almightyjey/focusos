import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireSession } from "@/server/auth";
import { getProfile } from "@/server/services/profiles";

export const metadata: Metadata = { title: "Ajustes" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Ajustes" description="Tu nombre, tu zona horaria y cómo se organiza la semana." />
      <Suspense fallback={<Skeleton className="h-80 w-full max-w-lg" />}>
        <SettingsContent />
      </Suspense>
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
