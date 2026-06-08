import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub *project* pages are served from https://USER.github.io/<repo>/
// so the build must know that sub-path. The deploy workflow sets VITE_BASE
// automatically; locally it defaults to "/".
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
})
