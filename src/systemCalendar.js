// Події з системного Календаря macOS через вбудований calendar-helper (EventKit).
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const supported = process.platform === 'darwin';

function helperPath() {
  const { app } = require('electron');
  return app.isPackaged
    ? path.join(process.resourcesPath, 'calendar-helper')
    : path.join(__dirname, '..', 'build', 'bin', 'calendar-helper');
}

const DENIED_MSG =
  'Немає доступу до Календаря. Відкрийте Системні параметри → Приватність і безпека → Календарі ' +
  'та дозвольте «Повний доступ» для Clawd Reminder.';

function loadSystemEvents(daysAhead = 7) {
  return new Promise((resolve) => {
    if (!supported) return resolve({ events: [], calendars: [], error: null });
    const bin = helperPath();
    if (!fs.existsSync(bin)) return resolve({ events: [], calendars: [], error: 'Не знайдено calendar-helper' });
    // перший запуск чекає, поки людина відповість на запит доступу — тому довгий тайм-аут
    execFile(bin, [String(daysAhead)], { timeout: 5 * 60 * 1000 }, (err, stdout) => {
      let data;
      try {
        data = JSON.parse(stdout);
      } catch {
        return resolve({ events: [], calendars: [], error: 'Календар Mac: ' + (err ? err.message : 'невідома помилка') });
      }
      if (data.error === 'denied') return resolve({ events: [], calendars: [], error: DENIED_MSG, denied: true });
      resolve({ events: data.events || [], calendars: data.calendars || [], error: null });
    });
  });
}

module.exports = { supported, loadSystemEvents };
