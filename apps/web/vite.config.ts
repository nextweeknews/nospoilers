import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@nospoilers/auth": fileURLToPath(new URL("../../services/auth/src/index.ts", import.meta.url)),
      "@nospoilers/types": fileURLToPath(new URL("../../packages/types/src/index.ts", import.meta.url)),
      "@nospoilers/ui": fileURLToPath(new URL("../../packages/ui/src/index.ts", import.meta.url))
    }
  }
});
