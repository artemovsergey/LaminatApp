import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/LaminatApp/',
  server: {
    port: 3000,
    open: true
  }
})
