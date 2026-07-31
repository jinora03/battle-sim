import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  base: "/battle-sim/",

  server: {
    host: true,
  },

  build: {
    target: "es2022",
  },
});