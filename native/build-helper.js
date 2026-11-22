// Компілює Swift-помічники (лише на macOS). На інших системах нічого не робить.
//  - calendar-helper: читає події з програми «Календар»
//  - Clawd Watcher:   перехоплює банери сповіщень (має власний дозвіл «Універсальний доступ»)
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.platform !== 'darwin') process.exit(0);

const dir = __dirname;
const outDir = path.join(dir, '..', 'build', 'bin');
fs.mkdirSync(outDir, { recursive: true });

for (const name of ['calendar-helper', 'Clawd Watcher']) {
  const src = path.join(dir, `${name}.swift`);
  const out = path.join(outDir, name);
  const plist = path.join(dir, name === 'Clawd Watcher' ? 'watcher-Info.plist' : 'helper-Info.plist');
  // не перекомпільовуємо, якщо нічого не змінилось
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs > Math.max(fs.statSync(src).mtimeMs, fs.statSync(plist).mtimeMs)) {
    continue;
  }
  execFileSync('xcrun', [
    'swiftc', '-O', '-target', 'arm64-apple-macos12', src, '-o', out,
    '-Xlinker', '-sectcreate', '-Xlinker', '__TEXT', '-Xlinker', '__info_plist', '-Xlinker', plist,
  ], { stdio: 'inherit' });
  execFileSync('codesign', ['--force', '--sign', '-', '--identifier', `com.clawd.reminder.${name.replace(' ', '-').toLowerCase()}`, out], { stdio: 'inherit' });
  console.log(`${name} зібрано:`, out);
}
