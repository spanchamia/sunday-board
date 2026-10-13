// Renders public/icons/icon.svg into the PNG sizes phones and browsers need.
// Run from app/:  node scripts/make-icons.mjs   (uses the Playwright Chromium)
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const svg = await readFile('public/icons/icon.svg', 'utf8');
// Maskable icons get cropped to a circle by Android: shrink the art into the safe zone.
const maskable = svg.replace('<g id="art">', '<g id="art" transform="translate(256 256) scale(0.8) translate(-256 -256)">');
const outputs = [
  { file: 'icon-192.png', size: 192, src: svg },
  { file: 'icon-512.png', size: 512, src: svg },
  { file: 'apple-touch-icon.png', size: 180, src: svg },
  { file: 'icon-maskable-512.png', size: 512, src: maskable },
];
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const o of outputs) {
  const page = await browser.newPage({ viewport: { width: o.size, height: o.size } });
  await page.setContent(`<html><body style="margin:0">${o.src.replace('<svg ', `<svg width="${o.size}" height="${o.size}" `)}</body></html>`);
  await page.screenshot({ path: `public/icons/${o.file}`, clip: { x: 0, y: 0, width: o.size, height: o.size } });
  await page.close();
  console.log('wrote', o.file);
}
await browser.close();
