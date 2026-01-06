import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  server: {
    port: 3000,
    open: true
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        gsap: resolve(__dirname, 'vanilla-gsap/index.html'),
        interact: resolve(__dirname, 'vanilla-interact/index.html')
      }
    }
  }
});

