// Компілює calendar-helper (лише на macOS). На інших системах нічого не робить.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.platform !== 'darwin') process.exit(0);

const dir = __dirname;
const out = path.join(dir, '..', 'build', 'bin', 'calendar-helper');
const src = path.join(dir, 'calendar-helper.swift');
const plist = path.join(dir, 'helper-Info.plist');

// не перекомпільовуємо, якщо нічого не змінилось
if (fs.existsSync(out) && fs.statSync(out).mtimeMs > Math.max(fs.statSync(src).mtimeMs, fs.statSync(plist).mtimeMs)) {
  process.exit(0);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
execFileSync('xcrun', [
  'swiftc', '-O', '-target', 'arm64-apple-macos12', src, '-o', out,
  '-Xlinker', '-sectcreate', '-Xlinker', '__TEXT', '-Xlinker', '__info_plist', '-Xlinker', plist,
], { stdio: 'inherit' });
execFileSync('codesign', ['--force', '--sign', '-', '--identifier', 'com.clawd.reminder.calendar-helper', out], { stdio: 'inherit' });
console.log('calendar-helper зібрано:', out);
