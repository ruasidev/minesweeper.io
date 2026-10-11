import { defineConfig } from "vite"
import react from "@vitejs/plugin-react-swc"
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: "/",
  build: {
    rollupOptions: {
      output: {
        // The board generator (WebAssembly, kept as text) goes in a file of its own. It changes far less often
        // than the rest of the site, so a returning player's browser keeps it across releases
        manualChunks: id => (id.endsWith("boardgen.wasm.ts") ? "boardgen" : undefined),
      },
    },
  },
  server: {
    // what the Rust code is built into: thousands of files that are nothing to do with the site
    watch: { ignored: ["**/target/**"] },
    // The API is its own server (see server/). Proxying it keeps everything on one origin
    // in development, so sign-in cookies work without any cross-site setup
    proxy: {
      // ws: the multiplayer WebSocket (/api/ws) goes through as well
      "/api": { target: "http://localhost:3000", ws: true },
    },
  },
})
