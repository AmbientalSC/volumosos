import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Quando gerar build nativo (Capacitor), precisamos de paths relativos para evitar tela branca
    // Use: `vite build --mode native` ou defina VITE_NATIVE=true
    const isNative = mode === 'native' || env.VITE_NATIVE === 'true' || env.CAPACITOR === 'true';
    return {
      // Web (GitHub Pages): '/volumosos/' | Nativo (Capacitor): './'
      base: isNative ? './' : '/volumosos/',
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
              firebase: ['firebase/app', 'firebase/firestore', 'firebase/storage', 'firebase/auth'],
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
