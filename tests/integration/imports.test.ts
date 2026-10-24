/**
 * Fase 9 contra el proyecto real de Supabase: deduplicación de importaciones,
 * aislamiento entre usuarios y tokens inaccesibles desde el navegador. Usa la
 * clave publicable, igual que el navegador; si faltan usuarios, se omite.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ExternalTaskCandidate } from "@/domain/task-import";
import type { Database } from "@/lib/supabase/database.types";
import { applyTaskImport } from "@/server/services/task-import";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const userA = { email: process.env.E2E_USER_A_EMAIL, password: process.env.E2E_USER_A_PASSWORD };
const userB = { email: process.env.E2E_USER_B_EMAIL, password: process.env.E2E_USER_B_PASSWORD };
const configured = Boolean(url && key && userA.email && userA.password && userB.email && userB.password);

type Client = SupabaseClient<Database>;

async function signedIn(credentials: { email?: string; password?: string }) {
  const client = createClient<Database>(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email: credentials.email!,
    password: credentials.password!,
  });
  if (error) throw error;
  return { client, userId: data.user.id };
}

describe.skipIf(!configured)("Importaciones y credenciales", () => {
  let a: { client: Client; userId: string };
  let b: { client: Client; userId: string };
  const source = `vitest-${Date.now()}`;
  const candidates: ExternalTaskCandidate[] = [
    { externalId: "page-1", title: "Importada 1", dueAt: "2026-10-31T03:59:00.000Z", done: false, estimatedMinutes: 30 },
    { externalId: "page-2", title: "Importada 2", dueAt: null, done: true, estimatedMinutes: null },
  ];

  const tasksOf = async (client: Client) => {
    const { data, error } = await client
      .from("tasks")
      .select("title, status, external_id, estimated_minutes")
      .eq("external_source", source)
      .order("external_id");
    if (error) throw error;
    return data;
  };

  beforeAll(async () => {
    [a, b] = await Promise.all([signedIn(userA), signedIn(userB)]);
  });

  afterAll(async () => {
    await Promise.all([
      a?.client.from("tasks").delete().eq("external_source", source),
      b?.client.from("tasks").delete().eq("external_source", source),
    ]);
  });

  it("importar dos veces no duplica", async () => {
    const first = await applyTaskImport(a.client, a.userId, source, candidates, { subjectId: null });
    expect(first).toEqual({ created: 2, updated: 0, unchanged: 0, failed: 0, duplicates: 0 });

    const second = await applyTaskImport(a.client, a.userId, source, candidates, { subjectId: null });
    expect(second).toEqual({ created: 0, updated: 0, unchanged: 2, failed: 0, duplicates: 0 });

    expect(await tasksOf(a.client)).toEqual([
      { title: "Importada 1", status: "pending", external_id: "page-1", estimated_minutes: 30 },
      { title: "Importada 2", status: "completed", external_id: "page-2", estimated_minutes: null },
    ]);
  });

  it("actualiza lo que cambió en la fuente", async () => {
    const changed = [{ ...candidates[0]!, title: "Importada 1 (editada)", done: true }, candidates[1]!];
    const outcome = await applyTaskImport(a.client, a.userId, source, changed, { subjectId: null });
    expect(outcome).toMatchObject({ created: 0, updated: 1, unchanged: 1, failed: 0 });
    expect((await tasksOf(a.client))[0]).toMatchObject({ title: "Importada 1 (editada)", status: "completed" });
  });

  it("la base rechaza un duplicado aunque se salte la app", async () => {
    const { error } = await a.client
      .from("tasks")
      .insert({ title: "Duplicada", external_source: source, external_id: "page-1" });
    expect(error?.code).toBe("23505");
  });

  it("otro usuario puede importar el mismo id sin ver ni tocar las del primero", async () => {
    const outcome = await applyTaskImport(b.client, b.userId, source, candidates.slice(0, 1), { subjectId: null });
    expect(outcome.created).toBe(1);
    expect(await tasksOf(b.client)).toHaveLength(1);
    expect(await tasksOf(a.client)).toHaveLength(2);
  });

  it("los tokens de integraciones no se pueden leer ni escribir desde el navegador", async () => {
    const read = await a.client.from("integration_credentials").select("*");
    expect(read.error?.code).toBe("42501");
    const write = await a.client
      .from("integration_credentials")
      .insert({ user_id: a.userId, provider: "notion", secret: "x" });
    expect(write.error?.code).toBe("42501");
  });

  it("el usuario no puede marcarse como conectado: el estado lo escribe el servidor", async () => {
    const { error } = await a.client.from("integrations").insert({ provider: "openai", status: "connected" });
    expect(error?.code).toBe("42501");
  });
});
