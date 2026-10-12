import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_ELECTRON === '1' ? './' : '/',
  plugins: [react()],
  server: {
    strictPort: true,
    hmr: {
      host: 'localhost'
    }
  }
})
