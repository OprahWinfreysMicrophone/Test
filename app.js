document.getElementById('year').textContent = new Date().getFullYear();

function toggleMenu() {
  document.getElementById('mobile-menu').classList.toggle('hidden');
}

document.addEventListener('click', function(e) {
  const menu = document.getElementById('mobile-menu');
  const toggle = document.querySelector('.nav-toggle');
  if (!menu || !toggle) return;
  if (!menu.contains(e.target) && !toggle.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

// Minimal CSV parser that handles quoted fields, commas, and in-cell newlines.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  row.push(field); rows.push(row);
  return rows;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function colIndex(headers, regex) {
  for (let i = 0; i < headers.length; i++) {
    if (regex.test((headers[i] || '').trim())) return i;
  }
  return -1;
}

/*
  ANNOUNCEMENT BANNER - loads text from a published Google Sheet

  HOW STAFF UPDATE IT:
  - Type the announcement in the cell under the "What banner says:" heading
    to show the banner; clear that cell to hide it.
  The code matches the heading, so the exact cell doesn't matter.
*/
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTOvU22yMDIhE8uy3leOkEXfx4jh115HxUqFx6LqZTJZWmHrXbCkWnQsT8EYuuFm9GhJ6kUpaoKsrhe/pub?output=csv';

function getBannerMessage(rows) {
  const norm = (v) => (v || '').trim();
  for (let c = 0; rows[0] && c < rows[0].length; c++) {
    if (/banner/i.test(norm(rows[0][c]))) {
      return rows[1] ? norm(rows[1][c]) : '';
    }
  }
  if (rows[1]) {
    const values = rows[1].map(norm).filter(Boolean);
    if (values.length) return values[values.length - 1];
  }
  return '';
}

async function loadBanner() {
  const bannerEl = document.getElementById('banner');
  if (!bannerEl || !SHEET_URL || SHEET_URL.includes('PASTE_')) return;
  try {
    const res = await fetch(SHEET_URL);
    const rows = parseCSV(await res.text());
    const message = getBannerMessage(rows);
    if (message) {
      document.getElementById('banner-text').textContent = message;
      bannerEl.classList.remove('hidden');
    }
  } catch (e) {}
}

loadBanner();

/*
  CALENDARS - current-month grids driven by published Google Sheets.

  Mark a container in the HTML like this:
    <div class="calendar-wrap" data-calendar
         data-cal-url="<published CSV link>"
         data-cal-kind="meals">          (or "activities")
      <div class="cal-title"></div>
      <div class="cal-body"><p class="cal-loading">Loading...</p></div>
    </div>

  SHEET LAYOUT: a "Date" column plus a content column.
    - Activities sheet: Date | Activity (or Event)
    - Meals sheet:      Date | Meal  (one row per menu item; repeat the date
                        to list several items on the same day)
  Dates accepted: M/D/YYYY, M/D/YY, or YYYY-MM-DD.
*/
const CAL_KINDS = {
  meals:      { match: /meal|lunch|menu/i,       emoji: '\u{1F37D}', cls: 'cal-meal' },
  activities: { match: /activit|event|program/i, emoji: '\u{1F4C5}', cls: 'cal-event' }
};

// Turn a date string into a "YYYY-M-D" key (no leading zeros).
function parseDateKey(str) {
  const s = (str || '').trim();
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${+y}-${+m[1]}-${+m[2]}`;
  }
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    return `${+m[1]}-${+m[2]}-${+m[3]}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
  }
  return null;
}

function pickValueColumn(headers, kind) {
  const k = CAL_KINDS[kind];
  const dateCol = colIndex(headers, /date/i);
  if (k) {
    const idx = colIndex(headers, k.match);
    if (idx !== -1) return idx;
  }
  for (let i = 0; i < headers.length; i++) if (i !== dateCol) return i;
  return -1;
}

function buildEntries(rows, kind) {
  const data = {};
  if (!rows.length) return data;
  const headers = rows[0];
  const dateCol = colIndex(headers, /date/i);
  const valCol = pickValueColumn(headers, kind);
  if (dateCol === -1 || valCol === -1) return data;
  for (let r = 1; r < rows.length; r++) {
    const key = parseDateKey(rows[r][dateCol]);
    if (!key) continue;
    const cell = (rows[r][valCol] || '').trim();
    if (!cell) continue;
    if (!data[key]) data[key] = [];
    cell.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      .forEach(item => data[key].push(item));
  }
  return data;
}

function renderCalendar(container, data, kind) {
  const grid = container.querySelector('.cal-body');
  const titleEl = container.querySelector('.cal-title');
  if (!grid) return;
  const k = CAL_KINDS[kind] || { emoji: '', cls: '' };
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = `${year}-${month + 1}-${now.getDate()}`;

  if (titleEl) titleEl.textContent = `${monthNames[month]} ${year}`;

  let html = '<div class="cal-grid">';
  dow.forEach(d => { html += `<div class="cal-dow">${d}</div>`; });
  for (let i = 0; i < startDay; i++) html += '<div class="cal-cell cal-empty"></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${month + 1}-${day}`;
    const items = data[key] || [];
    html += `<div class="cal-cell${key === todayKey ? ' cal-today' : ''}">`;
    html += `<div class="cal-daynum">${day}</div>`;
    items.forEach(t => {
      html += `<div class="cal-item ${k.cls}"><span class="cal-tag">${k.emoji}</span><span>${escapeHtml(t)}</span></div>`;
    });
    html += '</div>';
  }
  html += '</div>';
  grid.innerHTML = html;
}

async function initCalendar(container) {
  const url = container.getAttribute('data-cal-url');
  const kind = container.getAttribute('data-cal-kind') || '';
  if (!url || url.includes('PASTE_')) return;
  try {
    const res = await fetch(url);
    renderCalendar(container, buildEntries(parseCSV(await res.text()), kind), kind);
  } catch (e) {}
}

document.querySelectorAll('[data-calendar]').forEach(initCalendar);
