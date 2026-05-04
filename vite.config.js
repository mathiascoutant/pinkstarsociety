import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
var apiProxy = {
    "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
    },
};
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        /** Évite de passer sur 5174 sans qu’on le voie → sinon http://localhost:5173 refuse la connexion */
        strictPort: true,
        host: true,
        proxy: apiProxy,
    },
    /** Même proxy que en dev : `npm run preview` + API sur :8080 pour tester le build sans Docker */
    preview: {
        port: 4173,
        strictPort: true,
        host: true,
        proxy: apiProxy,
    },
});
