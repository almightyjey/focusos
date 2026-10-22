import { existsSync } from "node:fs";

// Carga variables locales sin sobrescribir las que ya vengan del entorno (CI).
for (const file of [".env.test.local", ".env.local"]) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
  }
}
