import { describe, expect, it } from "vitest";

import { fakeFetch } from "@/integrations/ai/test-fetch";
import {
  createNotionClient,
  getNotionSourceSchema,
  listNotionDataSources,
  notionAuthorizeUrl,
  notionPages,
} from "@/integrations/notion/client";

const dataSource = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  object: "data_source",
  id,
  title: [{ plain_text: name }],
  in_trash: false,
  properties: {},
  ...extra,
});

const notionError = (status: number, code: string) => ({
  status,
  body: { object: "error", status, code, message: "x" },
});

describe("cliente de Notion", () => {
  it("arma la URL de autorización con state", () => {
    const url = new URL(notionAuthorizeUrl({ clientId: "cid", clientSecret: "s" }, "http://localhost:3000/cb", "abc"));
    expect(url.origin + url.pathname).toBe("https://api.notion.com/v1/oauth/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "cid",
      response_type: "code",
      owner: "user",
      redirect_uri: "http://localhost:3000/cb",
      state: "abc",
    });
  });

  it("lista las bases compartidas, pagina y omite las de la papelera", async () => {
    const fake = fakeFetch([
      {
        status: 200,
        body: {
          object: "list",
          results: [dataSource("b", "Tareas"), dataSource("x", "Vieja", { in_trash: true })],
          has_more: true,
          next_cursor: "c2",
        },
      },
      { status: 200, body: { object: "list", results: [dataSource("a", "Álgebra")], has_more: false, next_cursor: null } },
    ]);
    const sources = await listNotionDataSources(createNotionClient("token", { fetch: fake.fetch }));
    expect(sources).toEqual([
      { id: "a", name: "Álgebra" },
      { id: "b", name: "Tareas" },
    ]);
    expect(fake.requests[0]!.headers.get("authorization")).toBe("Bearer token");
    expect(fake.requests[0]!.body).toMatchObject({ filter: { property: "object", value: "data_source" } });
    expect(fake.requests[1]!.body).toMatchObject({ start_cursor: "c2" });
  });

  it("simplifica el esquema de una base", async () => {
    const fake = fakeFetch({
      status: 200,
      body: dataSource("s", "Tareas", {
        properties: {
          Estado: { id: "1", name: "Estado", type: "status", status: { options: [{ name: "Listo" }], groups: [] } },
          Entrega: { id: "2", name: "Entrega", type: "date", date: {} },
        },
      }),
    });
    const schema = await getNotionSourceSchema(createNotionClient("token", { fetch: fake.fetch }), "s");
    expect(schema).toEqual({
      id: "s",
      name: "Tareas",
      properties: [
        { name: "Entrega", type: "date", options: [] },
        { name: "Estado", type: "status", options: ["Listo"] },
      ],
    });
  });

  it("recorre páginas hasta el límite", async () => {
    const pageRow = (id: string) => ({ object: "page", id, url: "u", created_time: "2026-10-01T00:00:00.000Z", properties: {} });
    const fake = fakeFetch({
      status: 200,
      body: { object: "list", results: [pageRow("p1"), pageRow("p2"), pageRow("p3")], has_more: false, next_cursor: null },
    });
    const ids: string[] = [];
    for await (const page of notionPages(createNotionClient("token", { fetch: fake.fetch }), "s", 2)) ids.push(page.id);
    expect(ids).toEqual(["p1", "p2"]);
  });

  it.each([
    [401, "unauthorized", "auth"],
    [404, "object_not_found", "not_found"],
    [403, "restricted_resource", "not_found"],
  ])("traduce el HTTP %i (%s) a %s", async (status, code, expected) => {
    const fake = fakeFetch(notionError(status, code));
    await expect(listNotionDataSources(createNotionClient("token", { fetch: fake.fetch }))).rejects.toMatchObject({
      name: "IntegrationError",
      code: expected,
    });
  });
});
