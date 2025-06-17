import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    // https: true, // Enable for microphone access (requires accepting self-signed cert)
    port: 5173,
    host: 'localhost',
  },
})