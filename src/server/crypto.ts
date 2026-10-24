import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Cifrado de tokens de integraciones con AES-256-GCM. El "contexto" (p. ej.
// "<user_id>:notion") va como dato autenticado: un token copiado a la fila de
// otro usuario no se puede descifrar.

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function keyFrom(base64: string): Buffer {
  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) throw new Error("La clave de cifrado debe tener 32 bytes.");
  return key;
}

export function encryptSecret(plaintext: string, keyBase64: string, context: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(keyBase64), iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(context, "utf8"));
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
}

/** Lanza un error si el texto se alteró, la clave no coincide o el contexto es otro. */
export function decryptSecret(payload: string, keyBase64: string, context: string): string {
  const [version, iv, tag, data, ...rest] = payload.split(".");
  if (version !== VERSION || !iv || !tag || data === undefined || rest.length > 0) {
    throw new Error("Formato de secreto no válido.");
  }
  const authTag = Buffer.from(tag, "base64url");
  if (authTag.length !== TAG_BYTES) throw new Error("Formato de secreto no válido.");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(keyBase64), Buffer.from(iv, "base64url"), {
    authTagLength: TAG_BYTES,
  });
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
