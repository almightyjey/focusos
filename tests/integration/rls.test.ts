/**
 * Aislamiento entre usuarios contra el proyecto real de Supabase.
 * Usa solo la clave publicable, igual que el navegador. Requiere dos usuarios
 * confirmados en .env.test.local (ver README); si faltan, se omite.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const userA = { email: process.env.E2E_USER_A_EMAIL, password: process.env.E2E_USER_A_PASSWORD };
const userB = { email: process.env.E2E_USER_B_EMAIL, password: process.env.E2E_USER_B_PASSWORD };
const configured = Boolean(url && key && userA.email && userA.password && userB.email && userB.password);

type Client = SupabaseClient<Database>;

function newClient(): Client {
  return createClient<Database>(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signedIn(credentials: { email?: string; password?: string }) {
  const client = newClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: credentials.email!,
    password: credentials.password!,
  });
  if (error) throw error;
  return { client, userId: data.user.id };
}

describe.skipIf(!configured)("RLS: aislamiento entre usuarios", () => {
  let a: { client: Client; userId: string };
  let b: { client: Client; userId: string };
  let subjectId: string;
  let taskId: string;
  let eventId: string;
  const name = `RLS vitest ${Date.now()}`;

  beforeAll(async () => {
    [a, b] = await Promise.all([signedIn(userA), signedIn(userB)]);

    const subject = await a.client.from("subjects").insert({ name }).select("id").single();
    if (subject.error) throw subject.error;
    subjectId = subject.data.id;

    const task = await a.client
      .from("tasks")
      .insert({ title: `${name} tarea`, subject_id: subjectId })
      .select("id")
      .single();
    if (task.error) throw task.error;
    taskId = task.data.id;

    const event = await a.client
      .from("schedule_events")
      .insert({
        title: `${name} clase`,
        subject_id: subjectId,
        starts_at: "2026-10-26T14:00:00Z",
        ends_at: "2026-10-26T15:30:00Z",
        recurrence_rule: "FREQ=WEEKLY;BYDAY=MO",
        timezone: "America/Santo_Domingo",
      })
      .select("id")
      .single();
    if (event.error) throw event.error;
    eventId = event.data.id;
  });

  afterAll(async () => {
    if (!a) return;
    await a.client.from("schedule_events").delete().eq("id", eventId);
    await a.client.from("tasks").delete().eq("id", taskId);
    await a.client.from("subjects").delete().eq("id", subjectId);
  });

  it("el dueño ve sus filas y user_id se asigna en la base", async () => {
    const { data, error } = await a.client.from("subjects").select("id, user_id").eq("id", subjectId);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: subjectId, user_id: a.userId }]);
  });

  it("otro usuario no puede leer materias ni tareas ajenas", async () => {
    const subjects = await b.client.from("subjects").select("id").eq("id", subjectId);
    const tasks = await b.client.from("tasks").select("id").eq("id", taskId);
    expect(subjects.data).toEqual([]);
    expect(tasks.data).toEqual([]);
  });

  it("otro usuario no puede modificar ni borrar filas ajenas", async () => {
    const update = await b.client.from("tasks").update({ title: "intrusión" }).eq("id", taskId).select("id");
    const remove = await b.client.from("subjects").delete().eq("id", subjectId).select("id");
    expect(update.data).toEqual([]);
    expect(remove.data).toEqual([]);

    const check = await a.client.from("tasks").select("title").eq("id", taskId).single();
    expect(check.data?.title).toBe(`${name} tarea`);
  });

  it("otro usuario no puede crear filas a nombre ajeno", async () => {
    const { error } = await b.client.from("subjects").insert({ name: "inyección", user_id: a.userId });
    expect(error?.code).toBe("42501");
  });

  it("otro usuario no puede enlazar su tarea a una materia ajena", async () => {
    const { error } = await b.client.from("tasks").insert({ title: "enlace ajeno", subject_id: subjectId });
    expect(error?.code).toBe("23503");
  });

  it("otro usuario no puede leer, cambiar ni enlazar eventos ajenos", async () => {
    const read = await b.client.from("schedule_events").select("id").eq("id", eventId);
    expect(read.data).toEqual([]);
    const update = await b.client.from("schedule_events").update({ title: "intrusión" }).eq("id", eventId).select("id");
    expect(update.data).toEqual([]);
    const link = await b.client.from("schedule_events").insert({
      title: "enlace ajeno",
      subject_id: subjectId,
      starts_at: "2026-10-26T14:00:00Z",
      ends_at: "2026-10-26T15:00:00Z",
    });
    expect(link.error?.code).toBe("23503");
  });

  it("una serie recurrente exige una zona horaria válida", async () => {
    const base = { title: "serie", starts_at: "2026-10-26T14:00:00Z", ends_at: "2026-10-26T15:00:00Z" };
    const missing = await a.client.from("schedule_events").insert({ ...base, recurrence_rule: "FREQ=WEEKLY;BYDAY=MO" });
    expect(missing.error?.code).toBe("23514");
    const invalid = await a.client
      .from("schedule_events")
      .insert({ ...base, recurrence_rule: "FREQ=WEEKLY;BYDAY=MO", timezone: "Mars/Olympus" });
    expect(invalid.error?.code).toBe("22023");
  });

  it("las calificaciones son privadas y respetan sus rangos", async () => {
    const created = await a.client
      .from("grade_items")
      .insert({ subject_id: subjectId, title: `${name} parcial`, score: 85, max_score: 100, weight: 25 })
      .select("id")
      .single();
    expect(created.error).toBeNull();
    try {
      const read = await b.client.from("grade_items").select("id").eq("id", created.data!.id);
      expect(read.data).toEqual([]);
      const update = await b.client.from("grade_items").update({ score: 100 }).eq("id", created.data!.id).select("id");
      expect(update.data).toEqual([]);
      const link = await b.client.from("grade_items").insert({ subject_id: subjectId, title: "nota ajena" });
      expect(link.error?.code).toBe("23503");
      const overWeight = await a.client.from("grade_items").insert({ subject_id: subjectId, title: "x", weight: 120 });
      expect(overWeight.error?.code).toBe("23514");
      const zeroMax = await a.client.from("grade_items").insert({ subject_id: subjectId, title: "x", max_score: 0 });
      expect(zeroMax.error?.code).toBe("23514");
    } finally {
      await a.client.from("grade_items").delete().eq("id", created.data!.id);
    }
  });

  it("nadie puede marcar una integración como conectada desde el cliente", async () => {
    const { error } = await a.client.from("integrations").insert({ provider: "notion", status: "connected" });
    expect(error?.code).toBe("42501");
  });

  it("sin sesión no hay acceso a los datos", async () => {
    const anon = newClient();
    const { data, error } = await anon.from("subjects").select("id");
    expect(data ?? []).toEqual([]);
    expect(error?.code).toBe("42501");
  });
});
