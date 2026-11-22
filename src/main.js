const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadAll } = require('./calendar');
const systemCal = require('./systemCalendar');
const notif = require('./notifWatcher');
const { clawdPng } = require('./clawd');
const Clawds = require('./clawds');

const CHECK_EVERY_MS = 15 * 1000; // як часто перевіряємо, чи пора нагадувати
const SYNC_EVERY_MS = 2 * 60 * 1000; // як часто читаємо Календар Mac (він локальний, це дешево)
const ICS_EVERY_MS = 10 * 60 * 1000; // як часто завантажуємо календарі за посиланням
const FIRE_WINDOW_MS = 3 * 60 * 1000; // запізнення, з яким ще можна показати нагадування

const DEFAULT_CONFIG = {
  useSystemCalendar: systemCal.supported, // брати події з Календаря Mac автоматично
  calendars: [], // [{ name, url }] — додаткові календарі за iCal-посиланням
  leads: [30, 5], // за скільки хвилин нагадувати
  side: 'random', // random | left | right | top | bottom
  clawdColor: 'classic', // колір Clawd (див. src/clawds.js) або random
  clawdEmotion: 'cool', // емоція Clawd (див. src/clawds.js) або random
  showSeconds: 7,
  launchAtLogin: false,
  interceptNotifications: notif.supported, // показувати Clawd замість банерів сповіщень
  interceptSources: ['calendar', 'duet'], // звідки перехоплювати (див. SOURCES)
  interceptKeywords: [], // додатково: будь-які сповіщення з цими словами
};

const BROWSERS = ['Google Chrome', 'Safari', 'Arc', 'Firefox', 'Microsoft Edge', 'Brave Browser', 'Opera', 'Chromium', 'Vivaldi'];
// Джерела сповіщень: назви програм (як їх показує macOS) і, за потреби, слова в тексті
const SOURCES = {
  calendar: { label: 'Календар (Apple і Google)', apps: ['Calendar', 'Календар'] },
  duet: { label: 'Claude Duet (у браузері)', apps: BROWSERS, words: ['duet', 'claude'] },
  telegram: { label: 'Telegram', apps: ['Telegram'] },
  viber: { label: 'Viber', apps: ['Viber'] },
  discord: { label: 'Discord', apps: ['Discord'] },
  zoom: { label: 'Zoom', apps: ['zoom.us', 'Zoom'] },
  messages: { label: 'Повідомлення', apps: ['Messages', 'Повідомлення'] },
  mail: { label: 'Пошта', apps: ['Mail', 'Пошта'] },
  reminders: { label: 'Нагадування', apps: ['Reminders', 'Нагадування'] },
};

function watcherRules() {
  const rules = (config.interceptSources || [])
    .filter((k) => SOURCES[k])
    .map((k) => ({ apps: SOURCES[k].apps, words: SOURCES[k].words || [] }));
  if (config.interceptKeywords.length) rules.push({ apps: [], words: config.interceptKeywords });
  return rules;
}

let config, tray, settingsWin, overlayWin;
let events = [];
let syncErrors = [];
let lastSync = null;
let systemCalendars = [];
let ics = { events: [], errors: [], at: 0, key: '' }; // кеш календарів за посиланням
const queue = [];
let fired = {};
let notifState = { status: 'off' };

const userFile = (name) => path.join(app.getPath('userData'), name);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveConfig() {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(userFile('config.json'), JSON.stringify(config, null, 2));
}

function saveFired() {
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  for (const k of Object.keys(fired)) if (fired[k] < dayAgo) delete fired[k];
  fs.writeFileSync(userFile('fired.json'), JSON.stringify(fired));
}

// ---------- Текст нагадування ----------
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function whenText(ms) {
  const min = Math.round(ms / 60000);
  if (min <= 0) return 'Вже починається';
  if (min < 60) return `Через ${min} ${plural(min, 'хвилину', 'хвилини', 'хвилин')}`;
  const h = Math.floor(min / 60), rest = min % 60;
  let s = `Через ${h} ${plural(h, 'годину', 'години', 'годин')}`;
  if (rest) s += ` ${rest} хв`;
  return s;
}

function timeText(ts) {
  return new Date(ts).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

// ---------- Синхронізація та перевірка ----------
let syncing = null;
function sync(force = false) {
  // не запускаємо дві синхронізації одночасно
  if (!syncing) syncing = doSync(force).finally(() => (syncing = null));
  return syncing;
}

async function doSync(force) {
  const errors = [];
  let all = [];

  if (config.useSystemCalendar && systemCal.supported) {
    const sys = await systemCal.loadSystemEvents();
    systemCalendars = sys.calendars;
    if (sys.error) errors.push(sys.error);
    all.push(...sys.events);
  } else {
    systemCalendars = [];
  }

  const key = JSON.stringify(config.calendars);
  if (!config.calendars.length) {
    ics = { events: [], errors: [], at: Date.now(), key };
  } else if (force || key !== ics.key || Date.now() - ics.at > ICS_EVERY_MS) {
    const res = await loadAll(config.calendars);
    ics = { ...res, at: Date.now(), key };
  }
  errors.push(...ics.errors);
  all.push(...ics.events);

  all.sort((a, b) => a.start - b.start);
  events = all;
  syncErrors = errors;
  lastSync = Date.now();
  // короткий стан для діагностики (без назв подій)
  try {
    fs.writeFileSync(userFile('status.json'), JSON.stringify({
      lastSync: new Date(lastSync).toISOString(),
      systemCalendars: systemCalendars.length,
      upcomingEvents: events.filter((e) => e.start > Date.now()).length,
      errors,
    }, null, 2));
  } catch {}
  if (settingsWin) settingsWin.webContents.send('events-updated');
}

function check() {
  const now = Date.now();
  let changed = false;
  for (const ev of events) {
    for (const lead of config.leads) {
      const at = ev.start - lead * 60000;
      const key = `${ev.id}|${lead}`;
      if (now >= at && now - at < FIRE_WINDOW_MS && !fired[key]) {
        fired[key] = now;
        changed = true;
        queue.push({ when: whenText(ev.start - now), title: ev.title, time: timeText(ev.start) });
      }
    }
  }
  if (changed) saveFired();
  showNext();
}

// ---------- Перехоплення сповіщень ----------
function startWatcher() {
  notif.stop();
  notifState = { status: 'off' };
  const rules = watcherRules();
  if (!config.interceptNotifications || !notif.supported || !rules.length) return;
  const dumpFile = process.env.CLAWD_NOTIF_DUMP ? userFile('notif-dump.log') : null;
  notif.start({
    rules,
    onStatus: (st) => {
      notifState = st;
      if (settingsWin) settingsWin.webContents.send('events-updated');
    },
    onNotification: (n, closed) => {
      const fallback = n.desc.split(', ').slice(1);
      const title = n.title || fallback[0] || 'Сповіщення';
      const body = [n.subtitle, n.body].filter(Boolean).join(' · ') || fallback.slice(1).join(', ');
      queue.push({ when: title, title: body, note: n.app });
      if (dumpFile) fs.appendFileSync(dumpFile, JSON.stringify({ at: new Date().toISOString(), ...n, closed }) + '\n');
      showNext();
    },
    onDump: dumpFile
      ? (tree) => fs.appendFileSync(dumpFile, JSON.stringify({ at: new Date().toISOString(), tree }) + '\n')
      : undefined,
  });
}

// ---------- Вікно з Clawd ----------
function showNext() {
  if (overlayWin || !queue.length) return;
  const item = queue.shift();
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const b = display.workArea;
  const sides = ['left', 'right', 'top', 'bottom'];
  const side = config.side === 'random' ? sides[Math.floor(Math.random() * 4)] : config.side;
  const color = Clawds.pick(Clawds.COLORS, config.clawdColor);
  const emotion = Clawds.pick(Clawds.EMOTIONS, config.clawdEmotion);

  overlayWin = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    transparent: true, frame: false, resizable: false, movable: false,
    focusable: false, skipTaskbar: true, hasShadow: false, show: false,
    alwaysOnTop: true, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWin.webContents.once('did-finish-load', () => {
    overlayWin.showInactive();
    overlayWin.webContents.send('overlay:show', { ...item, side, color, emotion, seconds: config.showSeconds });
  });
  overlayWin.on('closed', () => {
    overlayWin = null;
    setTimeout(showNext, 400);
  });
}

ipcMain.on('overlay:interactive', (_e, on) => {
  if (overlayWin) overlayWin.setIgnoreMouseEvents(!on, { forward: true });
});
ipcMain.on('overlay:done', () => {
  if (overlayWin) overlayWin.close();
});

// ---------- Налаштування ----------
function openSettings() {
  if (settingsWin) return settingsWin.focus();
  settingsWin = new BrowserWindow({
    width: 560, height: 720, minWidth: 420, minHeight: 500,
    title: 'Clawd-нагадувач', icon: nativeImage.createFromBuffer(clawdPng(256)),
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, 'settings.html'));
  settingsWin.on('closed', () => (settingsWin = null));
}

ipcMain.handle('config:get', () => config);
ipcMain.handle('sources:get', () => Object.entries(SOURCES).map(([id, s]) => ({ id, label: s.label })));
ipcMain.handle('config:save', async (_e, next) => {
  const prevWatch = JSON.stringify([config.interceptNotifications, config.interceptSources, config.interceptKeywords]);
  config = { ...config, ...next };
  config.interceptKeywords = (config.interceptKeywords || []).map((k) => String(k).trim()).filter(Boolean);
  config.interceptSources = (config.interceptSources || []).filter((k) => SOURCES[k]);
  if (JSON.stringify([config.interceptNotifications, config.interceptSources, config.interceptKeywords]) !== prevWatch) startWatcher();
  config.leads = [...new Set(config.leads.map(Number).filter((n) => n >= 0))].sort((a, b) => b - a);
  saveConfig();
  if (process.platform !== 'linux') {
    app.setLoginItemSettings({ openAtLogin: !!config.launchAtLogin });
  }
  await sync(true).catch(() => {});
  return config;
});
ipcMain.handle('events:get', () => ({
  events: events.filter((e) => e.start > Date.now()).slice(0, 30),
  errors: syncErrors,
  lastSync,
  systemCalendars,
  systemSupported: systemCal.supported,
  notifStatus: notifState.status,
}));
ipcMain.handle('events:refresh', () => sync(true).catch(() => {}));
ipcMain.handle('open-privacy', (_e, what) =>
  require('electron').shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?' +
      (what === 'accessibility' ? 'Privacy_Accessibility' : 'Privacy_Calendars')
  )
);
ipcMain.handle('test', () => testReminder());
ipcMain.handle('test-notif', () => testNotification());

// Перевірка перехоплення: «Календар» надішле справжній банер через хвилину.
// (Власні сповіщення програма без сертифіката Apple надсилати не може.)
function testNotification() {
  return systemCal.createTestEvent();
}

function testReminder() {
  const next = events.find((e) => e.start > Date.now());
  queue.push(
    next
      ? { when: whenText(next.start - Date.now()), title: next.title, time: timeText(next.start) }
      : { when: 'Через 30 хвилин', title: 'Урок (тест)', time: timeText(Date.now() + 30 * 60000) }
  );
  showNext();
}

// ---------- Запуск ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (argv.includes('--test-notif')) return testNotification();
    openSettings();
  });

  app.whenReady().then(() => {
    config = { ...DEFAULT_CONFIG, ...readJson(userFile('config.json'), {}) };
    fired = readJson(userFile('fired.json'), {});
    // старе налаштування «clawd» → колір + емоція
    const OLD = { classic: ['classic', 'cool'], bare: ['classic', 'neutral'], pink: ['pink', 'cool'],
      angry: ['red', 'angry'], kind: ['classic', 'kind'], sleepy: ['classic', 'sleepy'], random: ['random', 'random'] };
    if (config.clawd && OLD[config.clawd]) [config.clawdColor, config.clawdEmotion] = OLD[config.clawd];
    delete config.clawd;
    // старі налаштування: слова «Календар/Calendar/Duet» тепер є джерелами
    config.interceptKeywords = (config.interceptKeywords || []).filter(
      (k) => !['календар', 'calendar', 'duet'].includes(String(k).toLowerCase())
    );
    config.useSystemCalendar = systemCal.supported; // Календар Mac завжди увімкнений

    if (process.platform === 'darwin') app.dock.hide();

    const icon = process.platform === 'darwin'
      ? nativeImage.createFromBuffer(clawdPng(36), { scaleFactor: 2 })
      : nativeImage.createFromBuffer(clawdPng(32));
    tray = new Tray(icon);
    tray.setToolTip('Clawd-нагадувач');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Налаштування', click: openSettings },
      { label: 'Показати Clawd (тест)', click: testReminder },
      { label: 'Оновити календарі', click: () => sync(true).catch(() => {}) },
      { type: 'separator' },
      { label: 'Вийти', click: () => app.quit() },
    ]));

    startWatcher();
    sync().catch(() => {}).finally(check);
    setInterval(() => sync().catch(() => {}), SYNC_EVERY_MS);
    setInterval(check, CHECK_EVERY_MS);

    const firstRun = !fs.existsSync(userFile('config.json'));
    if (firstRun) saveConfig();
    if (firstRun || (!config.calendars.length && !config.useSystemCalendar) || process.argv.includes('--settings')) {
      openSettings();
    }
    if (process.argv.includes('--test')) setTimeout(testReminder, 500);
  });

  app.on('will-quit', () => notif.stop());

  // програма живе в треї, тож не виходимо після закриття вікон
  app.on('window-all-closed', () => {});
}
