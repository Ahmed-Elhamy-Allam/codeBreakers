import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // When running plain `npm run dev` (no `vercel dev`), the /api serverless
  // functions aren't served locally. Set VITE_API_PROXY to your deployed
  // Vercel URL (e.g. https://code-breakers-team.vercel.app) and the dev
  // server will forward /api/* there so the full app works locally.
  const apiProxy = env.VITE_API_PROXY;

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: apiProxy
        ? {
            '/api': {
              target: apiProxy,
              changeOrigin: true,
              secure: true,
            },
          }
        : undefined,
    },
  };
});
