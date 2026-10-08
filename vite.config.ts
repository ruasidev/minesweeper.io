import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  base: '/',
  server: {
    // The API is its own server (see server/). Proxying it keeps everything on one origin
    // in development, so sign-in cookies work without any cross-site setup
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
