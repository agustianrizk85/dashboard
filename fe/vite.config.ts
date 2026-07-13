import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Unified dashboard dev server.
//   - The Permit (Legal) module talks to its Go API via the `/api` dev proxy.
//     Locally that backend runs on :8081 (8080 is taken by Apache/XAMPP), so the
//     proxy target is read from VITE_PERMIT_API. We resolve it from BOTH the
//     shell env AND .env.local (via loadEnv) so `npx vite` picks up :8081 even
//     when the var isn't exported in the shell — otherwise /api/* silently
//     proxies to :8080 (Apache) and every Legal call 404s.
//   - Other modules (Perencanaan, Sales, Keuangan, Teknik, CSO, …) use absolute
//     base URLs (VITE_*_API), so they don't collide with the `/api` proxy.
// In production both are replaced by a single unified API (see .env.example).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const permitTarget = process.env.VITE_PERMIT_API ?? env.VITE_PERMIT_API ?? "http://localhost:8081";
  return {
    plugins: [react()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    server: {
      port: 5174,
      proxy: {
        "/api": {
          target: permitTarget,
          changeOrigin: true,
          ws: true, // proxy the Permit realtime WebSocket (/api/ws) too
        },
      },
    },
  };
});
