import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: {
    '/api/tavily/mcp': {
      target: 'https://mcp.tavily.com', changeOrigin: true,
      rewrite: () => '/mcp/',
      configure(proxy) {
        proxy.on('proxyReq', req => {
          req.removeHeader('origin');
          req.removeHeader('cookie');
        });
      },
    },
    '/api': 'http://127.0.0.1:8787',
  } },
  // Relative assets let the same build run at any GitHub Pages repository path.
  base: './'
})
