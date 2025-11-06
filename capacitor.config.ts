import type { CapacitorConfig } from '@capacitor/cli';

// Ajustes para garantir que o app não "trave" na Splash e para usar esquema https no WebView
const config: CapacitorConfig = {
  appId: 'ambientalsc.volumosos',
  appName: 'Volumosos BC',
  webDir: 'dist',
  server: {
    // Evita problemas de mixed content e mantém o WebView moderno
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      // Esconde a splash o mais rápido possível (se algo der errado no load, não fica "preso")
      launchShowDuration: 0,
      launchAutoHide: true
    }
  }
};

export default config;
