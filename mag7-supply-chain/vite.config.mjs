import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createLocalApiProxy } from "./vite.api-proxy.config.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxy = createLocalApiProxy(env);

  return {
    optimizeDeps: {
      include: ["react", "react-dom/client"],
    },
    server: {
      proxy: apiProxy,
      warmup: {
        clientFiles: ["./src/main.tsx"],
      },
    },
    preview: {
      proxy: apiProxy,
    },
    plugins: [react()],
  };
});
