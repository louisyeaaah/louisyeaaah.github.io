import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const root = import.meta.dirname;

export default defineConfig({
  base: '/',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    cssCodeSplit: false,
    sourcemap: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1500,
    // The four heaviest libraries are dynamically imported far below the fold
    // (or only on the lab page), so they must not be fetched with the entry.
    // Everything else keeps its preload hint because it really is on the
    // critical path. Without this filter Vite preloads tsParticles from
    // index.html, spending ~29 KB gzip on an effect nobody has scrolled to.
    modulePreload: {
      polyfill: true,
      resolveDependencies: (_filename, deps) =>
        deps.filter((dep) => !/vendor-(three|lottie|rive|tsparticles)/.test(dep)),
    },
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        lab: resolve(root, 'lab.html'),
      },
      output: {
        // Keep the chunk alias in the emitted filename so the size report can
        // attribute every byte to a specific library.
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // Split each animation library into its own chunk so the real
        // per-library cost is visible in the build output (and lazy-loadable).
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/three/') || id.includes('/three-')) return 'vendor-three';
          if (id.includes('/gsap/')) return 'vendor-gsap';
          if (id.includes('/motion') || id.includes('/framer-motion')) return 'vendor-motion';
          if (id.includes('/@tsparticles/')) return 'vendor-tsparticles';
          if (id.includes('/lottie-web/')) return 'vendor-lottie';
          if (id.includes('/@rive-app/')) return 'vendor-rive';
          if (id.includes('/animejs/')) return 'vendor-anime';
          if (id.includes('/lenis/')) return 'vendor-lenis';
          if (id.includes('/split-type/')) return 'vendor-splittype';
          if (id.includes('/auto-animate/')) return 'vendor-autoanimate';
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
