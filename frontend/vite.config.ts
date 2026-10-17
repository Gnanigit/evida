import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Fixed port so the backend's CORS allow-list matches the dev origin.
  server: { port: 5173, strictPort: true },
})
