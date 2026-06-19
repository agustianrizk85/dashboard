import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Unified dashboard dev server.
//   - The Permit module talks to its Go API via the `/api` dev proxy (-> :8080).
//   - The Perencanaan module talks to its Go API via an absolute base URL
//     (VITE_PERENCANAAN_API, default http://localhost:8082), so it does NOT
//     collide with the `/api` proxy above.
// In production both are replaced by a single unified API (see .env.example).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: process.env.VITE_PERMIT_API ?? "http://localhost:8080",
        changeOrigin: true,
        ws: true, // proxy the Permit realtime WebSocket (/api/ws) too
      },
    },
  },
});
