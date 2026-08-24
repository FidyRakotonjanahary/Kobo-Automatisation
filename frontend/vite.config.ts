import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
  },
  define: {
    // Rend la variable d'environnement disponible dans le code React
    // En local : utilise la valeur par défaut (http://127.0.0.1:8000/api)
    // En prod  : utilise VITE_API_BASE_URL défini dans Render
  },
});
