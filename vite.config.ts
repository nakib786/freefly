import { copyFileSync, createReadStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * The untouched 21.6 MB source GLB, which lives in `assets/models/` rather than
 * `public/` so that nothing can pull it in by accident.
 *
 * Two mount points, both dev-only:
 *   /src-model/*          model-check.html, to A/B the LODs against the source
 *   /models/source/*      the public path, so /credits uses one URL everywhere
 *
 * The second is the one that matters. `copySourceModel` puts the same file at
 * the same path in `dist/`, so the credits page never needs to know whether it
 * is running against the dev server or a deploy.
 */
function serveSourceModels(): Plugin {
  const send = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
    const file = fileURLToPath(new URL(`./assets/models${req.url}`, import.meta.url));
    res.setHeader('Content-Type', 'model/gltf-binary');
    createReadStream(file).on('error', next).pipe(res);
  };

  return {
    name: 'freefly:serve-source-models',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/src-model', send);
      server.middlewares.use('/models/source', send);
    },
  };
}

/**
 * Ships that same source GLB to `dist/models/source/` for the credits page.
 *
 * It is the one genuinely heavy thing in the deploy, and it is deliberate: the
 * CC-BY licence on the car is easier to check against the actual file, and the
 * page never requests it until a visitor has read the size and clicked. The
 * `/models/*` rule in public/_headers gives it an immutable cache.
 */
function copySourceModel(): Plugin {
  return {
    name: 'freefly:copy-source-model',
    apply: 'build',
    closeBundle() {
      const from = fileURLToPath(new URL('./assets/models/tesla-model-3-ameer.glb', import.meta.url));
      const dir = fileURLToPath(new URL('./dist/models/source/', import.meta.url));
      mkdirSync(dir, { recursive: true });
      copyFileSync(from, `${dir}tesla-model-3-ameer.glb`);
    },
  };
}

/**
 * Clean URLs for every extra document, in both dev and preview.
 *
 * Cloudflare Pages serves `credits.html` at `/credits` on its own, so the
 * deployed links work without any config. Neither Vite server does, and a
 * footer link that 404s locally is the kind of thing that gets "fixed" by
 * changing the link to the ugly URL. Rewriting here keeps one href correct
 * everywhere.
 *
 * Preview matters as much as dev now: the generated city pages only exist in
 * `dist/`, so `vite preview` is the only local way to see what actually
 * deploys, and it 404s on an extensionless path exactly like dev did.
 */
function cleanUrls(): Plugin {
  /**
   * `from` is where the documents live for that server: the project root in
   * dev, `dist/` in preview. The rewrite only fires when the .html actually
   * exists there, so an unbuilt city page still 404s honestly instead of being
   * rewritten to a path that 404s for a confusing reason.
   */
  const rewriter = (from: URL) => (req: IncomingMessage, _res: ServerResponse, next: () => void) => {
    // Split the query off first, or ?scene=full (the QA flag the whole
    // 3D path is exercised with) misses the match and falls through to a 404.
    const [path, query] = (req.url ?? '').split('?');

    if (/^\/[a-z0-9-]+\/?$/i.test(path)) {
      const name = path.replace(/^\/|\/$/g, '');
      if (existsSync(fileURLToPath(new URL(`${name}.html`, from)))) {
        req.url = `/${name}.html${query ? `?${query}` : ''}`;
      }
    }
    next();
  };

  return {
    name: 'freefly:clean-urls',
    configureServer(server) {
      server.middlewares.use(rewriter(new URL('./', import.meta.url)));
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewriter(new URL('./dist/', import.meta.url)));
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
 * generates into `public/photos/`, and would publish two road-test result
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
  plugins: [
    react(),
    tailwindcss(),
    serveSourceModels(),
    captureSink(),
    excludeRawPhotos(),
    copySourceModel(),
    cleanUrls(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    /**
     * `vite dev` does not run Pages Functions, so /api/plans used to 404 here and
     * the pricing section silently showed its bundled fallback, indistinguishable
     * from the live read being broken, and unfixable by any amount of .env editing
     * (that file is read by the Function, never by Vite).
     *
     * Borrowing the deployed endpoint is enough to see real prices locally. It
     * exercises the *deployed* Function rather than your edits to it, so use
     * `npm run dev:full` when the thing you are changing is functions/api/plans.ts.
     *
     * Points at the canonical host. It used to be `new.`, which was retired: the
     * hostname now fails its TLS handshake rather than 404ing, so this proxy
     * broke silently and local pricing fell back to the bundled snapshot.
     */
    proxy: {
      '/api/plans': {
        target: 'https://www.freeflydriving.ca',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    // Two documents, named explicitly. model-check.html and static-hero.html are
    // dev harnesses and are left out on purpose; naming any input at all means
    // index.html has to be listed too, so this is the whole production surface.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        credits: fileURLToPath(new URL('./credits.html', import.meta.url)),
      },
    },
    // No manualChunks here, deliberately. Naming three/r3f/gsap as manual
    // chunks made them siblings of the entry rather than children of the
    // dynamic import, and Vite then emitted <link rel="modulepreload"> for
    // them in index.html, which downloads ~1.2 MB of 3D engine on first load
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
