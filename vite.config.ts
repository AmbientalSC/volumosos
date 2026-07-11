import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Quando gerar build nativo (Capacitor), precisamos de paths relativos para evitar tela branca
    // Use: `vite build --mode native` ou defina VITE_NATIVE=true
    const isNative = mode === 'native' || env.VITE_NATIVE === 'true' || env.CAPACITOR === 'true';
    // Build para o subdomínio próprio no Coolify (serve da raiz, não de um subpath do GH Pages)
    const isCoolify = mode === 'coolify' || env.VITE_DEPLOY_TARGET === 'coolify';
    return {
      // Web (GitHub Pages): '/volumosos/' | Coolify (domínio próprio): '/' | Nativo (Capacitor): './'
      base: isNative ? './' : isCoolify ? '/' : '/volumosos/',
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              firebase: ['firebase/app', 'firebase/auth'],
            }
          }
        },
        chunkSizeWarningLimit: 1000
      },
      server: {
        port: 3000,
        open: true
      }
    };
});
