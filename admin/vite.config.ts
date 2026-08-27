import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'EXPO_PUBLIC_');
  const isDev = env.EXPO_PUBLIC_DEV_MODE === 'true';
  const devApiUrl = env.EXPO_PUBLIC_DEV_API_URL || 'https://2f58-154-161-238-136.ngrok-free.app';
  const devSocketUrl = env.EXPO_PUBLIC_DEV_SOCKET_URL || 'https://2f58-154-161-238-136.ngrok-free.app';
  const prodApiUrl = env.EXPO_PUBLIC_API_URL || 'https://api.shopyosgh.com';
  const prodSocketUrl = env.EXPO_PUBLIC_SOCKET_URL || 'https://socket.shopyosgh.com';

  const targetApiUrl = isDev ? devApiUrl : prodApiUrl;
  const targetSocketUrl = isDev ? devSocketUrl : prodSocketUrl;

  console.log(`🔧 Vite Proxy mode: isDev=${isDev}, targetApi=${targetApiUrl}, targetSocket=${targetSocketUrl}`);

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    envPrefix: 'EXPO_PUBLIC_',
    server: {
      proxy: {
        '/api': {
          target: targetApiUrl,
          changeOrigin: true,
          secure: false,
          headers: {
            'ngrok-skip-browser-warning': '1'
          }
        },
        '/socket.io': {
          target: targetSocketUrl,
          ws: true,
          changeOrigin: true,
          secure: false,
          headers: {
            'ngrok-skip-browser-warning': '1'
          }
        }
      }
    }
  };
});
