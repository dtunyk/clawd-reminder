// Завантаження календарів у форматі iCal (.ics) — працює і з Google, і з Apple (iCloud).
const ical = require('node-ical');

function normalizeUrl(url) {
  url = url.trim();
  // Apple дає посилання webcal:// — це той самий https
  if (url.startsWith('webcal://')) url = 'https://' + url.slice('webcal://'.length);
  return url;
}

async function fetchCalendar(url) {
  const res = await fetch(normalizeUrl(url), { headers: { 'User-Agent': 'FunnyReminder/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Це не iCal-посилання (.ics)');
  return ical.sync.parseICS(text);
}

// Повертає всі події (з розгорнутими повтореннями) у вікні [from, to]
function extractEvents(data, from, to, calendarName) {
  const out = [];
  for (const ev of Object.values(data)) {
    if (!ev || ev.type !== 'VEVENT' || !ev.start) continue;
    if (ev.recurrenceid) continue; // перевизначення обробляє expandRecurringEvent
    let instances;
    try {
      instances = ical.expandRecurringEvent(ev, { from, to });
    } catch (e) {
      continue;
    }
    for (const inst of instances) {
      if (inst.isFullDay) continue; // події на весь день не нагадуємо
      const start = new Date(inst.start);
      if (start < from || start > to) continue;
      out.push({
        id: `${ev.uid || inst.summary}|${start.toISOString()}`,
        title: (inst.summary && (inst.summary.val || inst.summary)) || 'Подія',
        start: start.getTime(),
        calendar: calendarName,
      });
    }
  }
  return out;
}

async function loadAll(calendars, daysAhead = 7) {
  const from = new Date(Date.now() - 60 * 60 * 1000);
  const to = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const events = [];
  const errors = [];
  await Promise.all(
    calendars.map(async (cal) => {
      try {
        const data = await fetchCalendar(cal.url);
        events.push(...extractEvents(data, from, to, cal.name || 'Календар'));
      } catch (e) {
        errors.push(`${cal.name || cal.url}: ${e.message}`);
      }
    })
  );
  events.sort((a, b) => a.start - b.start);
  return { events, errors };
}

module.exports = { loadAll, extractEvents, normalizeUrl };
