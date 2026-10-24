import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Caché de solo lectura con lo que se generó en el build. Basta para FocusOS:
// las páginas privadas se arman en cada petición (datos del usuario dentro de
// <Suspense>) y no hay ISR ni "use cache". Si algún día se usa revalidación por
// tiempo o por etiquetas, hará falta R2 + caché de etiquetas en D1.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
