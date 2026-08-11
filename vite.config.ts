import { createReadStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Serves the untouched 21.6 MB source GLB at /src-model/* during dev only, so
 * model-check.html can A/B the decimated LODs against the original. It is not
 * in publicDir, so it never reaches a production build.
 */
function serveSourceModels(): Plugin {
  return {
    name: 'freefly:serve-source-models',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/src-model', (req, res, next) => {
        const file = fileURLToPath(new URL(`./assets/models${req.url}`, import.meta.url));
        res.setHeader('Content-Type', 'model/gltf-binary');
        createReadStream(file).on('error', next).pipe(res);
      });
    },
  };
}

/**
 * Dev-only sink for canvas captures. model-check.html POSTs a base64 PNG here
 * and it lands on disk, which is how the decimated model gets reviewed at full
 * resolution instead of through a scaled screenshot.
 */
function captureSink(): Plugin {
  return {
    name: 'freefly:capture-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/dev-capture', (req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const { name, png } = JSON.parse(Buffer.concat(chunks).toString());
          const dir = fileURLToPath(new URL('./.captures/', import.meta.url));
          mkdirSync(dir, { recursive: true });
          const out = `${dir}${String(name).replace(/[^a-z0-9._-]/gi, '_')}.png`;
          writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, out }));
        });
      });
    },
  };
}

/**
 * Keeps the raw client photos out of the deployed build.
 *
 * `public/Pics/` holds the ~40 MB of original phone JPEGs the client supplied.
 * Vite copies publicDir wholesale, so without this every deploy would ship the
 * originals alongside the 3.3 MB of optimised WebP that `npm run photos`
 * generates into `public/photos/` — and would publish two road-test result
 * forms containing personal data that prepare-photos.mjs deliberately excludes.
 *
 * Removing it from `dist/` after the copy leaves the source files untouched.
 */
function excludeRawPhotos(): Plugin {
  return {
    name: 'freefly:exclude-raw-photos',
    apply: 'build',
    closeBundle() {
      const dir = fileURLToPath(new URL('./dist/Pics', import.meta.url));
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serveSourceModels(), captureSink(), excludeRawPhotos()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    // No manualChunks here, deliberately. Naming three/r3f/gsap as manual
    // chunks made them siblings of the entry rather than children of the
    // dynamic import, and Vite then emitted <link rel="modulepreload"> for
    // them in index.html — which downloads ~1.2 MB of 3D engine on first load
    // for every visitor, including the ones the capability check is about to
    // send down the static-image path. Letting Rollup split them naturally
    // keeps them inside the lazily-imported DriveScene graph, where they are
    // only fetched once a device has been cleared for 3D.
    modulePreload: {
      // Belt and braces: never preload the scene graph from the document.
      resolveDependencies: (_url, deps) =>
        deps.filter((dep) => !/three|drei|fiber|DriveScene|gsap/i.test(dep)),
    },
  },
});
