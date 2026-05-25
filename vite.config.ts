import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxy = {
  "/api": {
    target: "http://localhost:8080",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    /** Sinon Vite attend la fin du crawl fichiers avant toute requête HTTP */
    holdUntilCrawlEnd: false,
  },
  server: {
    port: 5173,
    /** Évite de passer sur 5174 sans qu’on le voie → sinon http://localhost:5173 refuse la connexion */
    strictPort: true,
    host: true,
    proxy: apiProxy,
    /** Pré-transforme l’entrée au démarrage pour éviter une page blanche au 1er chargement */
    warmup: {
      clientFiles: ["./index.html", "./src/main.tsx"],
    },
    watch: {
      ignored: ["**/.claude/**"],
    },
  },
  /** Même proxy que en dev : `npm run preview` + API sur :8080 pour tester le build sans Docker */
  preview: {
    port: 4173,
    strictPort: true,
    host: true,
    proxy: apiProxy,
  },
});
