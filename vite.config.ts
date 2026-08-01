import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  build: {
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/pdfmake/build/vfs_fonts")) return "vendor-pdfmake-fonts";
          if (id.includes("node_modules/pdfmake")) return "vendor-pdfmake";
          if (id.includes("node_modules/recharts")) return "vendor-charts";
          if (id.includes("node_modules/@radix-ui")) return "vendor-radix";
        },
      },
    },
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // Dev-only: forwards /api/* to a local PHP backend (e.g. `php -S localhost:8000 -t public_html`)
    // so admin auth (/api/admin/me.php, /api/admin/login.php, etc.) works under `npm run dev`.
    // Does not affect `vite build` — server.proxy only applies to the dev server.
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
