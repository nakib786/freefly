/**
 * Dev-only page screenshots via headless Chrome's DevTools protocol.
 *
 *   node scripts/shoot.mjs [url] [--w=1440] [--h=900] [--scroll=0.5] [--out=name]
 *
 * Chrome is driven over a raw CDP websocket rather than through Puppeteer so
 * this needs no extra dependency — the browser is already on the machine, and
 * pulling in a 300 MB automation package to take a picture would be silly.
 *
 * WebGL matters here: `--headless=new` with SwiftShader renders the 3D layer
 * correctly, just slowly, which is why the waits below are generous.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, '.captures');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));

if (!CHROME) throw new Error('No Chrome or Edge binary found for screenshots');

const arg = (name, fallback) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=').slice(1).join('=') : fallback;
};

const url = /^(https?|file):/.test(process.argv[2] ?? '') ? process.argv[2] : 'http://localhost:5180/';
const width = Number(arg('w', 1440));
const height = Number(arg('h', 900));
const scroll = Number(arg('scroll', 0));
const name = arg('out', 'page');
const settle = Number(arg('settle', 6000));
const port = 9333 + Math.floor(Math.random() * 400);
const PROFILE = resolve(tmpdir(), `freefly-shoot-${port}`);

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--window-size=${width},${height}`,
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    // Unique profile per run. A shared one makes a second invocation attach to
    // the first browser's lock instead of starting its own, and the debugging
    // port never opens.
    //
    // Kept in the OS temp dir, NOT under .captures/. A Chrome profile is tens
    // of thousands of files, and inside the project vite's watcher picks the
    // whole tree up: the dev server floods with reload events mid-run and then
    // restarts, so the shot lands on a half-mounted page. Screenshots of an
    // empty document are the symptom.
    '--user-data-dir=' + PROFILE,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function endpoint() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const data = await res.json();
      if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  throw new Error('Chrome did not expose a debugging endpoint');
}

let id = 0;
function rpc(ws, method, params = {}, sessionId) {
  return new Promise((resolveCall, rejectCall) => {
    const callId = ++id;
    const onMessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== callId) return;
      ws.removeEventListener('message', onMessage);
      msg.error ? rejectCall(new Error(msg.error.message)) : resolveCall(msg.result);
    };
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id: callId, method, params, sessionId }));
  });
}

try {
  const wsUrl = await endpoint();
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => {
    ws.addEventListener('open', r, { once: true });
    ws.addEventListener('error', j, { once: true });
  });

  const { targetId } = await rpc(ws, 'Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await rpc(ws, 'Target.attachToTarget', { targetId, flatten: true });

  await rpc(ws, 'Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  }, sessionId);

  if (process.argv.includes('--reduced')) {
    await rpc(ws, 'Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    }, sessionId);
  }

  await rpc(ws, 'Page.enable', {}, sessionId);
  await rpc(ws, 'Page.navigate', { url }, sessionId);
  await sleep(settle);

  if (scroll > 0) {
    // Stepped, not a single jump. The page reveals content on IntersectionObserver
    // entry and unobserves each node once shown, so a one-shot scrollTo past
    // several screens can land with sections that were never intersected still
    // at opacity 0 — the capture then shows empty bands where the copy should
    // be, which looks like a layout bug and is not one. Walking down in screen-
    // sized steps is also just what a reader does.
    const steps = Math.max(1, Math.ceil((scroll * 12000) / height));
    for (let i = 1; i <= steps; i++) {
      await rpc(ws, 'Runtime.evaluate', {
        expression: `window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * ${(scroll * i) / steps})`,
      }, sessionId);
      await sleep(220);
    }

    // Wait for the reveals to actually finish rather than guessing a duration.
    // Under headless compositing an opacity transition can take several seconds
    // of wall clock to advance even though it is authored at 0.9s, so a fixed
    // sleep produced screenshots with whole sections blank — which reads as a
    // layout bug in the page and is purely an artefact of the capture.
    const settled = `(() => {
      const inView = [...document.querySelectorAll('[data-reveal]')]
        .filter((n) => { const r = n.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
      return inView.length > 0 && inView.every((n) => Number(getComputedStyle(n).opacity) > 0.99);
    })()`;
    for (let waited = 0; waited < 15000; waited += 400) {
      const { result } = await rpc(ws, 'Runtime.evaluate', {
        expression: settled,
        returnByValue: true,
      }, sessionId);
      if (result.value) break;
      await sleep(400);
    }
    await sleep(400);
  }

  const { data } = await rpc(ws, 'Page.captureScreenshot', { format: 'png' }, sessionId);
  mkdirSync(OUT_DIR, { recursive: true });
  const out = resolve(OUT_DIR, `${name}.png`);
  writeFileSync(out, Buffer.from(data, 'base64'));

  const { result } = await rpc(ws, 'Runtime.evaluate', {
    expression: 'JSON.stringify({ h: document.documentElement.scrollHeight, err: window.__errors || [] })',
    returnByValue: true,
  }, sessionId);
  console.log(`${name}.png  ${width}x${height} scroll=${scroll}  page=${result.value}`);

  ws.close();
} finally {
  chrome.kill();
  // Best effort. kill() is not synchronous, so on Windows the profile's files
  // are usually still locked a moment later — and this is a temp directory the
  // OS will reap anyway. Failing the run over it would throw away the capture
  // that was just taken.
  try {
    rmSync(PROFILE, { recursive: true, force: true });
  } catch {
    // still held by the exiting browser; leave it to the OS
  }
}
