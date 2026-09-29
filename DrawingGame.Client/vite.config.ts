import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/game": {
        target: process.env.GAME_API_URL ?? "http://localhost:5266",
        ws: true,
      },
    },
  },
});
