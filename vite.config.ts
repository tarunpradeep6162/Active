import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // three's core is shared by everything; its add-ons (loaders, post passes, helpers) stay
        // with the lazy scene that imports them, so the first load carries only the core
        manualChunks: (id) =>
          id.includes('node_modules/three/examples') ? undefined : id.includes('node_modules/three') ? 'three' : id.includes('node_modules/react') ? 'react' : undefined,
      },
    },
  },
  worker: { format: 'es' },
});
