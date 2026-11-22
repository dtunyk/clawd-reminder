// Запускає Clawd Watcher, який перехоплює банери сповіщень macOS.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const supported = process.platform === 'darwin';

function helperPath() {
  if (process.env.CLAWD_NOTIF_HELPER) return process.env.CLAWD_NOTIF_HELPER; // для розробки
  const { app } = require('electron');
  return app.isPackaged
    ? path.join(process.resourcesPath, 'Clawd Watcher')
    : path.join(__dirname, '..', 'build', 'bin', 'Clawd Watcher');
}

let child = null;
let stopped = true;
let restartTimer = null;
let state = { status: 'off' }; // off | starting | no-permission | ready | error

// rules: [{ apps: [...], words: [...] }]
// onNotification({ app, title, subtitle, body, desc, texts }), onStatus(state), onDump(json)
function start({ rules, onNotification, onStatus, onDump }) {
  stop();
  if (!supported) return;
  const bin = helperPath();
  if (!fs.existsSync(bin)) {
    state = { status: 'error', message: 'Не знайдено Clawd Watcher' };
    return onStatus(state);
  }
  stopped = false;
  const args = ['--rules', JSON.stringify(rules)];
  if (onDump) args.push('--dump');
  state = { status: 'starting' };
  onStatus(state);

  child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'ignore'] });
  readline.createInterface({ input: child.stdout }).on('line', (line) => {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.status) {
      state = { status: msg.status };
      onStatus(state);
    } else if (msg.notification) {
      onNotification(msg.notification, msg.closed);
    } else if (msg.dump && onDump) {
      onDump(msg.dump);
    }
  });
  child.on('exit', () => {
    child = null;
    if (stopped) return;
    // впав — перезапускаємо через кілька секунд
    restartTimer = setTimeout(() => start({ rules, onNotification, onStatus, onDump }), 5000);
  });
}

function stop() {
  stopped = true;
  clearTimeout(restartTimer);
  if (child) child.kill();
  child = null;
  state = { status: 'off' };
}

module.exports = { supported, start, stop, getState: () => state };
