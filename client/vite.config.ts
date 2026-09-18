import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Proxy API requests to the backend during development.
    // When the frontend (port 5173) makes a request to /api/*,
    // Vite forwards it to the Express server (port 5000).
    // This avoids CORS issues and simulates production routing.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
