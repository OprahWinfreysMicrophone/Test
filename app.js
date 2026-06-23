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
  - Type the announcement into cell B2 to show the banner.
  - Clear cell B2 to hide the banner.
  (Changes appear on the site within a minute or two.)

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

async function loadBanner() {
  if (!SHEET_URL || SHEET_URL.includes('PASTE_YOUR')) return;
  try {
    const res = await fetch(SHEET_URL);
    const csv = await res.text();
    const rows = parseCSV(csv);
    // B2 = row index 1, column index 1
    const message = rows[1] && rows[1][1] ? rows[1][1].trim() : '';
    if (message) {
      document.getElementById('banner-text').textContent = message;
      document.getElementById('banner').classList.remove('hidden');
    }
  } catch (e) {}
}

loadBanner();
