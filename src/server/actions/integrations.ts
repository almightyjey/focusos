"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { notionImportSettingsSchema, type NotionSourceSchema } from "@/integrations/notion/settings";
import { fail, invalidInput, ok, type ActionResult } from "@/server/action-result";
import { requireSession } from "@/server/auth";
import { messageFromError } from "@/server/errors";
import {
  disconnectNotion,
  getNotionSource,
  importFromNotion,
  listNotionSources,
  saveNotionImportSettings,
  type NotionImportResult,
} from "@/server/services/integrations";
import { getProfile } from "@/server/services/profiles";

function refreshApp() {
  revalidatePath("/", "layout");
}

export async function listNotionSourcesAction(): Promise<ActionResult<{ id: string; name: string }[]>> {
  const session = await requireSession();
  try {
    return ok(await listNotionSources(session));
  } catch (error) {
    return fail(messageFromError(error));
  }
}

export async function getNotionSourceAction(dataSourceId: string): Promise<ActionResult<NotionSourceSchema>> {
  const parsed = notionImportSettingsSchema.shape.dataSourceId.safeParse(dataSourceId);
  if (!parsed.success) return fail("Base de Notion no válida.");
  const session = await requireSession();
  try {
    return ok(await getNotionSource(session, parsed.data));
  } catch (error) {
    return fail(messageFromError(error));
  }
}

export async function saveNotionSettingsAction(
  input: z.input<typeof notionImportSettingsSchema>,
): Promise<ActionResult> {
  const parsed = notionImportSettingsSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const session = await requireSession();
  try {
    await saveNotionImportSettings(session, parsed.data);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function importNotionAction(): Promise<ActionResult<NotionImportResult>> {
  const session = await requireSession();
  let result: NotionImportResult;
  try {
    const profile = await getProfile(session);
    result = await importFromNotion(session, profile.timezone);
  } catch (error) {
    refreshApp();
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok(result);
}

export async function disconnectNotionAction(): Promise<ActionResult<{ revoked: boolean }>> {
  const session = await requireSession();
  let result: { revoked: boolean };
  try {
    result = await disconnectNotion(session);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok(result);
}
