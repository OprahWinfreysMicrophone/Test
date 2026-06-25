document.getElementById('year').textContent = new Date().getFullYear();

function toggleMenu() {
  document.getElementById('mobile-menu').classList.toggle('hidden');
}

document.addEventListener('click', function(e) {
  const menu = document.getElementById('mobile-menu');
  const toggle = document.querySelector('.nav-toggle');
  if (!menu.contains(e.target) && !toggle.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

/*
  ANNOUNCEMENT BANNER - loads text from a published Google Sheet

  HOW STAFF UPDATE IT:
  - Open the announcement Google Sheet.
  - Type the announcement in the cell under the "What banner says:" heading
    to show the banner.
  - Clear that cell to hide the banner.
  (Changes appear on the site within a minute or two.)

  The code finds the right cell by matching the "What banner says:" heading,
  so the exact column/row doesn't matter as long as the heading stays.

  SETUP (already done): File > Share > Publish to web > CSV, then the
  published link is pasted into SHEET_URL below.
*/
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTOvU22yMDIhE8uy3leOkEXfx4jh115HxUqFx6LqZTJZWmHrXbCkWnQsT8EYuuFm9GhJ6kUpaoKsrhe/pub?output=csv';

// Minimal CSV parser that handles quoted fields and commas within text.
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

// Find the announcement text by locating the "banner" heading and reading the
// cell directly beneath it. Falls back to the last non-empty cell in row 2.
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
  if (!SHEET_URL || SHEET_URL.includes('PASTE_YOUR')) return;
  try {
    const res = await fetch(SHEET_URL);
    const csv = await res.text();
    const rows = parseCSV(csv);
    const message = getBannerMessage(rows);
    if (message) {
      document.getElementById('banner-text').textContent = message;
      document.getElementById('banner').classList.remove('hidden');
    }
  } catch (e) {}
}

loadBanner();

/*
  EVENTS CALENDAR - current month grid from a published Google Sheet

  SHEET LAYOUT (header row in row 1, then one row per entry):
    Date       | Meal                              | Event
    6/23/2026  | Baked chicken, green beans, roll  |
    6/24/2026  | Meatloaf, mashed potatoes         | Bingo 1pm
  - One row per day for the Meals on Wheels menu.
  - For more than one event on the same day, add another row with that date.
  - Blank cells are fine. Dates work as M/D/YYYY (Sheets default) or YYYY-MM-DD.

  SETUP: put this on a tab, then File > Share > Publish to web > that tab >
  CSV > Publish, and paste the link into CALENDAR_SHEET_URL below.
*/
const CALENDAR_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTOvU22yMDIhE8uy3leOkEXfx4jh115HxUqFx6LqZTJZWmHrXbCkWnQsT8EYuuFm9GhJ6kUpaoKsrhe/pub?gid=1308458512&single=true&output=csv';

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

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

function colIndex(headers, regex) {
  for (let i = 0; i < headers.length; i++) {
    if (regex.test((headers[i] || '').trim())) return i;
  }
  return -1;
}

function buildCalendarData(rows) {
  const data = {};
  if (!rows.length) return data;
  const headers = rows[0];
  const dateCol = colIndex(headers, /date/i);
  const mealCol = colIndex(headers, /meal/i);
  const eventCol = colIndex(headers, /event/i);
  if (dateCol === -1) return data;
  for (let r = 1; r < rows.length; r++) {
    const key = parseDateKey(rows[r][dateCol]);
    if (!key) continue;
    if (!data[key]) data[key] = { meals: [], events: [] };
    const meal = mealCol !== -1 ? (rows[r][mealCol] || '').trim() : '';
    const event = eventCol !== -1 ? (rows[r][eventCol] || '').trim() : '';
    if (meal) data[key].meals.push(meal);
    if (event) data[key].events.push(event);
  }
  return data;
}

function renderCalendar(data) {
  const wrap = document.getElementById('calendar-grid');
  if (!wrap) return;
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = `${year}-${month + 1}-${now.getDate()}`;

  const titleEl = document.getElementById('calendar-title');
  if (titleEl) titleEl.textContent = `${monthNames[month]} ${year}`;

  let html = '<div class="cal-grid">';
  dow.forEach(d => { html += `<div class="cal-dow">${d}</div>`; });
  for (let i = 0; i < startDay; i++) html += '<div class="cal-cell cal-empty"></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${month + 1}-${day}`;
    const entry = data[key];
    html += `<div class="cal-cell${key === todayKey ? ' cal-today' : ''}">`;
    html += `<div class="cal-daynum">${day}</div>`;
    if (entry) {
      entry.meals.forEach(t => {
        html += `<div class="cal-item cal-meal"><span class="cal-tag">&#127858;</span><span>${escapeHtml(t)}</span></div>`;
      });
      entry.events.forEach(t => {
        html += `<div class="cal-item cal-event"><span class="cal-tag">&#128197;</span><span>${escapeHtml(t)}</span></div>`;
      });
    }
    html += '</div>';
  }
  html += '</div>';
  wrap.innerHTML = html;
}

async function loadCalendar() {
  if (!CALENDAR_SHEET_URL || CALENDAR_SHEET_URL.includes('PASTE_')) return;
  try {
    const res = await fetch(CALENDAR_SHEET_URL);
    const csv = await res.text();
    renderCalendar(buildCalendarData(parseCSV(csv)));
  } catch (e) {}
}

loadCalendar();
