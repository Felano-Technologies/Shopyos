import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'EXPO_PUBLIC_');
  const isDev = env.EXPO_PUBLIC_DEV_MODE === 'true';
  const devApiUrl = env.EXPO_PUBLIC_DEV_API_URL || 'https://2f58-154-161-238-136.ngrok-free.app';
  const devSocketUrl = env.EXPO_PUBLIC_DEV_SOCKET_URL || 'https://2f58-154-161-238-136.ngrok-free.app';
  const prodApiUrl = env.EXPO_PUBLIC_API_URL || 'https://shopyos-production.up.railway.app';
  const prodSocketUrl = env.EXPO_PUBLIC_SOCKET_URL || 'https://shopyos-production.up.railway.app';

  const targetApiUrl = isDev ? devApiUrl : prodApiUrl;
  const targetSocketUrl = isDev ? devSocketUrl : prodSocketUrl;

  console.log(`🔧 Vite Proxy mode: isDev=${isDev}, targetApi=${targetApiUrl}, targetSocket=${targetSocketUrl}`);

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https?:\/\/.*\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24,
                },
                networkTimeoutSeconds: 10,
              },
            },
            {
              urlPattern: /^https?:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'image-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
            {
              urlPattern: /^https?:\/\/.*\.(?:js|css)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-resources',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
              },
            },
          ],
        },
        manifest: {
          name: 'Shopyos Marketplace',
          short_name: 'Shopyos',
          description: 'Multi-vendor marketplace and delivery tracking system',
          theme_color: '#0C1559',
          background_color: '#e9f0ff',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
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

