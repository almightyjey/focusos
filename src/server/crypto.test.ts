import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "@/server/crypto";

const key = Buffer.alloc(32, 1).toString("base64");
const otherKey = Buffer.alloc(32, 2).toString("base64");

describe("cifrado de tokens", () => {
  it("descifra lo que cifró con la misma clave y contexto", () => {
    const payload = encryptSecret('{"accessToken":"secreto"}', key, "user-a:notion");
    expect(payload).not.toContain("secreto");
    expect(decryptSecret(payload, key, "user-a:notion")).toBe('{"accessToken":"secreto"}');
  });

  it("usa un vector distinto en cada cifrado", () => {
    expect(encryptSecret("x", key, "c")).not.toBe(encryptSecret("x", key, "c"));
  });

  it("no descifra con otro contexto (fila de otro usuario)", () => {
    const payload = encryptSecret("token", key, "user-a:notion");
    expect(() => decryptSecret(payload, key, "user-b:notion")).toThrow();
  });

  it("no descifra con otra clave", () => {
    const payload = encryptSecret("token", key, "c");
    expect(() => decryptSecret(payload, otherKey, "c")).toThrow();
  });

  it("detecta datos alterados", () => {
    const [version, iv, tag, data] = encryptSecret("token", key, "c").split(".");
    const flipped = Buffer.from(data!, "base64url");
    flipped[0] = flipped[0]! ^ 1;
    expect(() => decryptSecret([version, iv, tag, flipped.toString("base64url")].join("."), key, "c")).toThrow();
  });

  it("rechaza formatos desconocidos y etiquetas recortadas", () => {
    const [version, iv, tag, data] = encryptSecret("token", key, "c").split(".");
    expect(() => decryptSecret("texto plano", key, "c")).toThrow();
    expect(() => decryptSecret(["v2", iv, tag, data].join("."), key, "c")).toThrow();
    expect(() => decryptSecret([version, iv, tag!.slice(0, 8), data].join("."), key, "c")).toThrow();
  });

  it("exige una clave de 32 bytes", () => {
    expect(() => encryptSecret("x", Buffer.alloc(16).toString("base64"), "c")).toThrow();
  });
});
