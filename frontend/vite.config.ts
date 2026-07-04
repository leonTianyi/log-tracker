import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, the Vite server proxies /api calls to the FastAPI backend so the
// browser sees a single origin. In the built (Docker) version FastAPI serves
// both the UI and /api from the same origin, so no proxy is needed there.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
