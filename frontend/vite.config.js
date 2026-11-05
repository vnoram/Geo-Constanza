import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Docker Desktop en Windows no avisa los cambios de archivos montados: se revisa por sondeo
  // para que el frontend tome las ediciones sin reiniciar el contenedor.
  server: { watch: { usePolling: true, interval: 500 } },
})
