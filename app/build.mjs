// Builds the app into dist/ with esbuild. No other build tooling needed.
//   node build.mjs           production build
//   node build.mjs --serve   rebuild on change and serve http://localhost:5173
import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const serve = process.argv.includes('--serve');
const out = 'dist';

function finish(result) {
  const files = Object.keys(result.metafile.outputs).map((f) => f.replace(`${out}/`, ''));
  const js = files.find((f) => f.endsWith('.js') && !f.endsWith('.map'));
  const css = files.find((f) => f.endsWith('.css') && !f.endsWith('.map'));
  cpSync('public', out, { recursive: true });
  const html = readFileSync('public/index.html', 'utf8')
    .replace('%APP_JS%', `/${js}`)
    .replace('%APP_CSS%', css ? `<link rel="stylesheet" href="/${css}">` : '');
  writeFileSync(join(out, 'index.html'), html);

  // Service worker: keeps the app shell available offline (e.g. in a store with weak signal).
  const precache = ['/', '/index.html', `/${js}`, ...(css ? [`/${css}`] : []), '/manifest.webmanifest',
    ...readdirSync('public/icons').map((f) => `/icons/${f}`)];
  const version = createHash('sha1').update(precache.join() + Date.now()).digest('hex').slice(0, 10);
  const sw = readFileSync('src/sw.template.js', 'utf8')
    .replace('__VERSION__', version)
    .replace('__PRECACHE__', JSON.stringify(precache));
  writeFileSync(join(out, 'sw.js'), sw);
  console.log(`built ${js}${css ? ` + ${css}` : ''} (sw ${version})`);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const options = {
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outdir: `${out}/assets`,
  entryNames: 'app-[hash]',
  format: 'esm',
  target: ['es2020', 'safari15'],
  minify: !serve,
  sourcemap: true,
  metafile: true,
  jsx: 'automatic',
  loader: { '.svg': 'text' },
  define: { 'process.env.NODE_ENV': JSON.stringify(serve ? 'development' : 'production') },
  logLevel: 'warning',
  plugins: [{ name: 'finish', setup(b) { b.onEnd((r) => { if (!r.errors.length) finish(r); }); } }],
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: out, port: 5173, fallback: `${out}/index.html` });
  console.log(`serving http://localhost:${port}`);
} else {
  await esbuild.build(options);
}
