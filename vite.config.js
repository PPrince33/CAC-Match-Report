import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/CAC-Match-Report/',
  plugins: [
    react(),
    tailwindcss(),
  ],
})
