import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Project pages are served from /hanzi-forge/, not the domain root.
  base: "/hanzi-forge/",
  plugins: [react()],
});
