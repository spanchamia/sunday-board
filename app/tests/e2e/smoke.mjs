// Smoke test: serves dist/ and checks the signed-out screens on a phone and a tablet.
// Run after `npm run build`. Needs Playwright with Chromium installed.
//   SCREENS=1 saves screenshots to tests/e2e/screens/
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join('dist', path === '/' ? 'index.html' : path);
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures++; };
if (process.env.SCREENS) await mkdir('tests/e2e/screens', { recursive: true });

for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 1024, height: 768 }]]) {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport, colorScheme: scheme });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(base);
    await page.getByRole('heading', { name: 'Sunday Board' }).waitFor();
    check(errors.length === 0, `${name}/${scheme}: no script errors ${errors.join('; ')}`);
    const email = page.getByLabel('Email');
    check(await email.isVisible(), `${name}/${scheme}: email field visible`);
    await page.getByRole('button', { name: 'Email me a sign-in code' }).click();
    check(await page.getByRole('alert').textContent() === 'Enter your email address, like name@example.com.', `${name}/${scheme}: empty email explains what to do`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(!overflow, `${name}/${scheme}: no sideways scrolling`);
    if (process.env.SCREENS) await page.screenshot({ path: `tests/e2e/screens/signin-${name}-${scheme}.png` });
    await page.close();
  }
}
// Appearance choice overrides the device setting, from first paint.
for (const [choice, device, want] of [['dark', 'light', 'rgb(17, 24, 20)'], ['light', 'dark', 'rgb(246, 248, 245)'], [null, 'dark', 'rgb(17, 24, 20)']]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: device });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  if (choice) await page.addInitScript((c) => localStorage.setItem('sb-theme', c), choice);
  await page.goto(base);
  await page.getByRole('heading', { name: 'Sunday Board' }).waitFor();
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(bg === want, `appearance ${choice ?? 'automatic'} on a ${device} device gives ${want} (got ${bg})`);
  if (process.env.SCREENS) await page.screenshot({ path: `tests/e2e/screens/theme-${choice ?? 'auto'}-on-${device}.png` });
  await page.close();
}

const manifest = await (await fetch(`${base}/manifest.webmanifest`)).json();
check(manifest.icons.some((i) => i.purpose === 'maskable'), 'manifest has a maskable icon');
check((await fetch(`${base}/sw.js`)).ok, 'service worker is published');

await browser.close();
server.close();
if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
