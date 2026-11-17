// While the app is closed, the site serves only a notice. A replacement service worker
// clears the offline copy installed phones and tablets kept. To reopen: set "build" back
// to "node build.mjs" in package.json.
import { cpSync, rmSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
cpSync('closed', 'dist', { recursive: true });
console.log('Built the "closed" notice into dist/');
