const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const cwd = path.resolve(__dirname, '..', 'shell-thumbnail-provider');
const dllPath = path.join(cwd, 'target', 'x86_64-pc-windows-msvc', 'release', 'bananyang_thumb.dll');

// Verify cargo is available
try {
    execSync('cargo --version', { stdio: 'pipe' });
} catch {
    console.error('[build-thumbnail-dll] cargo not found. Install Rust from https://rustup.rs/');
    console.error('[build-thumbnail-dll] Then run: rustup target add x86_64-pc-windows-msvc');
    process.exit(1);
}

console.log('[build-thumbnail-dll] Building bananyang_thumb.dll ...');
execSync('cargo build --release --target x86_64-pc-windows-msvc', { cwd, stdio: 'inherit' });

const stat = fs.statSync(dllPath);
console.log(`[build-thumbnail-dll] Done. ${dllPath} (${(stat.size / 1024).toFixed(0)} KB)`);
