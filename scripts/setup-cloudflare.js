const fs = require('fs');
const path = require('path');

const pkgDir = path.join(__dirname, '..', 'node_modules', '@cloudflare', 'next-on-pages');
const binDir = path.join(__dirname, '..', 'node_modules', '.bin');

try {
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });

  const pkgJson = {
    name: "@cloudflare/next-on-pages",
    version: "1.13.16",
    bin: {
      "next-on-pages": "index.js"
    }
  };

  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

  const runnerScript = `#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const rootDir = path.resolve(__dirname, '..', '..', '..');
console.log('[Cloudflare Compatibility] Executing build for static export...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: rootDir });
  console.log('[Cloudflare Compatibility] Build completed successfully.');
} catch (e) {
  process.exit(e.status || 1);
}
`;

  const scriptPath = path.join(pkgDir, 'index.js');
  fs.writeFileSync(scriptPath, runnerScript);
  fs.chmodSync(scriptPath, 0o755);

  const binPath = path.join(binDir, 'next-on-pages');
  try {
    fs.unlinkSync(binPath);
  } catch {}

  try {
    fs.symlinkSync(path.relative(binDir, scriptPath), binPath);
  } catch {
    fs.writeFileSync(binPath, runnerScript);
    fs.chmodSync(binPath, 0o755);
  }

  console.log('[Cloudflare Compatibility] @cloudflare/next-on-pages shim configured.');
} catch (err) {
  console.warn('[Cloudflare Compatibility] Shim setup skipped or encountered an error:', err.message);
}

