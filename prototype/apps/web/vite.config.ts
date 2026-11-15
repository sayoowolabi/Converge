import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Converge prototype: plain React + Vite. No Tailwind, no Figma Make plugins (see DECISIONS D-005).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
