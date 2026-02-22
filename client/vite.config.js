import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["socket.io-client"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Force resolution so Rollup finds socket.io-client in DO/build environments
      "socket.io-client": path.resolve(__dirname, "node_modules/socket.io-client"),
    },
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          @use "sass:color";
          @use "/src/styles/variables" as *;
        `,
        // Avoid build failure from deprecated global color functions (e.g. darken) in deps or legacy code
        silenceDeprecations: ['color-functions'],
      },
    },
  },
});
