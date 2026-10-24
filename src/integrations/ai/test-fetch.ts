// Ayudante de pruebas: un fetch falso que registra las peticiones y responde
// con JSON fijo. Permite probar los adaptadores con los SDK reales, sin red.

export type CapturedRequest = { url: string; method: string; headers: Headers; body: unknown };

export function fakeFetch(responses: { status: number; body: unknown }[] | { status: number; body: unknown }) {
  const queue = Array.isArray(responses) ? [...responses] : [responses];
  const requests: CapturedRequest[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const text = await request.text();
    requests.push({
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: text ? JSON.parse(text) : null,
    });
    const next = queue.length > 1 ? queue.shift()! : queue[0]!;
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetch: fetchImpl, requests };
}
