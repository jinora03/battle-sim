import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // GitHub Pages serves the app under /<repository-name>/. This must match the
  // repo name ("battle-sim"). CI additionally overrides it at deploy time with
  // `--base=/${{ github.event.repository.name }}/`; keep both in sync if the
  // repository is ever renamed, or local/preview builds will 404 their assets.
  base: "/battle-sim/",

  server: {
    host: true,
  },

  build: {
    target: "es2022",
  },
});