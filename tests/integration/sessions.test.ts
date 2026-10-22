/**
 * Temporizador de estudio contra el proyecto real: las funciones de la base
 * gobiernan el tiempo, respetan RLS y no permiten registrar de más.
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
  return createClient<Database>(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
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

/** Descarta una sesión activa que haya quedado de otra ejecución. */
async function cancelActive(client: Client) {
  const { data } = await client.from("study_sessions").select("id").eq("status", "active");
  for (const row of data ?? []) await client.rpc("cancel_study_session", { p_id: row.id });
}

describe.skipIf(!configured)("Temporizador de estudio (RPC + RLS)", () => {
  let a: { client: Client; userId: string };
  let b: { client: Client; userId: string };
  let taskId: string;
  let sessionId: string;
  const created: string[] = [];

  beforeAll(async () => {
    [a, b] = await Promise.all([signedIn(userA), signedIn(userB)]);
    await cancelActive(a.client);
    const task = await a.client.from("tasks").insert({ title: `Temporizador ${Date.now()}` }).select("id").single();
    if (task.error) throw task.error;
    taskId = task.data.id;
  });

  afterAll(async () => {
    if (!a) return;
    await cancelActive(a.client);
    if (created.length) await a.client.from("study_sessions").delete().in("id", created);
    await a.client.from("study_sessions").delete().eq("task_id", taskId);
    await a.client.from("tasks").delete().eq("id", taskId);
  });

  it("empieza una sesión con la hora del servidor y la materia de la tarea", async () => {
    const { data, error } = await a.client.rpc("start_study_session", { p_task_id: taskId, p_planned_minutes: 25 });
    expect(error).toBeNull();
    sessionId = data!.id;
    created.push(sessionId);
    expect(data).toMatchObject({ status: "active", task_id: taskId, planned_minutes: 25, paused_seconds: 0 });
    expect(Math.abs(Date.parse(data!.started_at!) - Date.now())).toBeLessThan(60_000);
  });

  it("no permite dos sesiones activas a la vez", async () => {
    const { error } = await a.client.rpc("start_study_session", {});
    expect(error?.code).toBe("23505");
  });

  it("otro usuario no ve ni controla la sesión", async () => {
    const read = await b.client.from("study_sessions").select("id").eq("id", sessionId);
    expect(read.data).toEqual([]);
    const pause = await b.client.rpc("pause_study_session", { p_id: sessionId });
    expect(pause.error?.code).toBe("P0002");
    const finish = await b.client.rpc("finish_study_session", { p_id: sessionId });
    expect(finish.error?.code).toBe("P0002");
    const start = await b.client.rpc("start_study_session", { p_task_id: taskId });
    expect(start.error?.code).toBe("P0002");
  });

  it("pausa y reanuda una sola vez cada vez", async () => {
    const paused = await a.client.rpc("pause_study_session", { p_id: sessionId });
    expect(paused.data?.paused_at).not.toBeNull();
    const again = await a.client.rpc("pause_study_session", { p_id: sessionId });
    expect(again.error?.code).toBe("P0002");
    const resumed = await a.client.rpc("resume_study_session", { p_id: sessionId });
    expect(resumed.data?.paused_at).toBeNull();
    expect(resumed.data?.paused_seconds).toBeGreaterThanOrEqual(0);
  });

  it("al terminar nunca registra más de lo medido", async () => {
    const { data, error } = await a.client.rpc("finish_study_session", {
      p_id: sessionId,
      p_focus_seconds: 999_999,
      p_notes: "  límites laterales  ",
    });
    expect(error).toBeNull();
    expect(data?.status).toBe("completed");
    const span = (Date.parse(data!.ended_at!) - Date.parse(data!.started_at!)) / 1000;
    expect(data!.focus_seconds).toBeLessThanOrEqual(Math.ceil(span));
    expect(data!.notes).toBe("límites laterales");
    const finishedAgain = await a.client.rpc("finish_study_session", { p_id: sessionId });
    expect(finishedAgain.error?.code).toBe("P0002");
  });

  it("acumula el tiempo real por tarea solo para su dueño", async () => {
    const endedAt = new Date(Date.now() - 60 * 60_000);
    const startedAt = new Date(endedAt.getTime() - 30 * 60_000);
    const manual = await a.client
      .from("study_sessions")
      .insert({
        task_id: taskId,
        status: "completed",
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        focus_seconds: 1800,
      })
      .select("id")
      .single();
    expect(manual.error).toBeNull();
    created.push(manual.data!.id);

    const mine = await a.client.from("task_focus_totals").select("*").eq("task_id", taskId).single();
    expect(mine.data?.focus_seconds).toBeGreaterThanOrEqual(1800);
    expect(mine.data?.session_count).toBe(2);
    const theirs = await b.client.from("task_focus_totals").select("*").eq("task_id", taskId);
    expect(theirs.data).toEqual([]);
  });

  it("rechaza tiempo en el futuro o mayor que la duración", async () => {
    const future = await a.client.from("study_sessions").insert({
      status: "completed",
      started_at: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
      ended_at: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
      focus_seconds: 600,
    });
    expect(future.error?.code).toBe("22023");
    const inflated = await a.client.from("study_sessions").insert({
      status: "completed",
      started_at: new Date(Date.now() - 20 * 60_000).toISOString(),
      ended_at: new Date(Date.now() - 10 * 60_000).toISOString(),
      focus_seconds: 3600,
    });
    expect(inflated.error?.code).toBe("23514");
  });

  it("sin sesión no se pueden usar las funciones", async () => {
    const { error } = await newClient().rpc("start_study_session", {});
    expect(error?.code).toBe("42501");
  });
});
