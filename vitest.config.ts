import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Vite's default ts->.ts resolver doesn't follow Deno-style explicit
    // `.ts` imports inside `supabase/functions/_shared/`. Pull those
    // modules through the same loader so the render-test harness can
    // import them directly.
    server: { deps: { inline: [/supabase\/functions\/_shared/] } },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
