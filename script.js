/* =========================================================
   Student Deadline Manager - script.js
   Plain JavaScript, no frameworks.

   Sections:
     1. One-time user login      (localStorage)
     2. Deadline data            (load / save / add / delete)
     3. Date calculations        (days remaining, status)
     4. Rendering                (dashboard, cards, reminders)
     5. Filter / search / sort
     6. Smart Deadline Extraction (rule-based, no AI)
     7. Events & app startup
   ========================================================= */

'use strict';

/* ================= 1. ONE-TIME LOGIN ================= */

const USER_KEY = 'sdm_user';              // where we remember the user's name

const loginScreen = document.getElementById('login-screen');
const appScreen   = document.getElementById('app-screen');

// Show the right screen: login OR the app
function showCorrectScreen() {
  const savedUser = localStorage.getItem(USER_KEY);
  if (savedUser) {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    document.getElementById('user-name').textContent = savedUser;
    document.getElementById('greeting').textContent = makeGreeting(savedUser);
  } else {
    loginScreen.classList.remove('hidden');
    appScreen.classList.add('hidden');
  }
}

// Greeting like "Good morning, Aarav!"
function makeGreeting(name) {
  const hour = new Date().getHours();
  let part = 'Hello';
  if (hour < 12) part = 'Good morning';
  else if (hour < 17) part = 'Good afternoon';
  else part = 'Good evening';
  return part + ', ' + name + '! 👋';
}

// When the login form is submitted -> save the name, never ask again
document.getElementById('login-form').addEventListener('submit', function (e) {
  e.preventDefault();                                  // stop page reload
  const name = document.getElementById('login-name').value.trim();
  if (!name) return;
  localStorage.setItem(USER_KEY, name);
  showCorrectScreen();
  showToast('Welcome, ' + name + '! 🎉');
});

// "Change user" button in the header
document.getElementById('change-user').addEventListener('click', function () {
  if (confirm('Change user on this device? Your deadlines stay saved.')) {
    localStorage.removeItem(USER_KEY);
    showCorrectScreen();
  }
});

/* ================= 2. DEADLINE DATA ================= */

const STORAGE_KEY = 'sdm_deadlines';

// Each deadline looks like:
// { id, title, date: '2026-09-28', category, description, completed: false }
let deadlines = loadDeadlines();

function loadDeadlines() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];   // if stored data is corrupted, start fresh
  }
}

function saveDeadlines() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deadlines));
}

function addDeadline(title, date, category, description) {
  deadlines.push({
    id: Date.now() + Math.random(),   // simple unique id
    title: title,
    date: date,
    category: category,
    description: description || '',
    completed: false
  });
  saveDeadlines();
  renderAll();
}

function deleteDeadline(id) {
  deadlines = deadlines.filter(function (d) { return d.id !== id; });
  saveDeadlines();
  renderAll();
}

function toggleComplete(id) {
  const dl = deadlines.find(function (d) { return d.id === id; });
  if (dl) {
    dl.completed = !dl.completed;
    saveDeadlines();
    renderAll();
  }
}

/* ================= 3. DATE CALCULATIONS ================= */

// Whole days from TODAY until the deadline (0 = today, negative = past)
function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  return Math.round((due - today) / 86400000);   // 86400000 ms in a day
}

// Decide the status of a deadline
function getStatus(dl) {
  if (dl.completed) return 'Completed';
  const diff = daysUntil(dl.date);
  if (diff < 0)  return 'Overdue';
  if (diff === 0) return 'Due Today';
  if (diff <= 3) return 'Due Soon';
  return 'Upcoming';
}

// '2026-09-28' -> '28 September 2026'
function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Human countdown text
function countdownText(dl) {
  const diff = daysUntil(dl.date);
  if (dl.completed) return '✅ Completed';
  if (diff === 0) return '⚠️ Due today!';
  if (diff === 1) return '⚠️ Due in 1 day';
  if (diff > 1)   return 'Due in ' + diff + ' days';
  return '🚨 Overdue by ' + Math.abs(diff) + ' day' + (Math.abs(diff) > 1 ? 's' : '');
}

/* ================= 4. RENDERING ================= */

// Small helper: keeps user text safe when inserting into HTML
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function renderAll() {
  renderStats();
  renderReminders();
  renderNextDeadline();
  renderDeadlineList();
}

// --- Dashboard stat cards ---
function renderStats() {
  const open = deadlines.filter(function (d) { return !d.completed; });

  const upcoming  = open.filter(function (d) { return daysUntil(d.date) >= 0; }).length;
  const dueSoon   = open.filter(function (d) { const x = daysUntil(d.date); return x >= 0 && x <= 3; }).length;
  const completed = deadlines.filter(function (d) { return d.completed; }).length;

  const next = open
    .filter(function (d) { return daysUntil(d.date) >= 0; })
    .sort(function (a, b) { return a.date.localeCompare(b.date); })[0];

  document.getElementById('stat-upcoming').textContent  = upcoming;
  document.getElementById('stat-duesoon').textContent   = dueSoon;
  document.getElementById('stat-completed').textContent = completed;

  const nextEl = document.getElementById('stat-next');
  if (next) {
    nextEl.textContent = next.title.length > 22 ? next.title.slice(0, 22) + '…' : next.title;
    document.getElementById('stat-next-label').textContent =
      'Next Deadline • ' + formatDate(next.date);
  } else {
    nextEl.textContent = '—';
    document.getElementById('stat-next-label').textContent = 'Next Deadline';
  }
}

// --- Dashboard reminders (visual only, no browser notifications) ---
function renderReminders() {
  const list = document.getElementById('reminder-list');
  const open = deadlines
    .filter(function (d) { return !d.completed && daysUntil(d.date) <= 7; })
    .sort(function (a, b) { return a.date.localeCompare(b.date); });

  if (open.length === 0) {
    const anyOpen = deadlines.some(function (d) { return !d.completed; });
    list.innerHTML = anyOpen
      ? '<li>🎉 Nothing due in the next 7 days. Enjoy!</li>'
      : '<li class="empty-state">No reminders yet.<br>' +
        '<button class="link-btn" id="sample-btn">Load sample deadlines</button> or add your own!</li>';
    const btn = document.getElementById('sample-btn');
    if (btn) btn.addEventListener('click', loadSampleData);
    return;
  }

  list.innerHTML = open.map(function (d) {
    const diff = daysUntil(d.date);
    let cls = '';
    let icon = '📅';
    if (diff <= 0) { cls = 'urgent'; icon = '🚨'; }
    else if (diff <= 3) { cls = 'warn'; icon = '⚠️'; }
    const when = diff === 0 ? 'today' : 'in ' + diff + ' day' + (diff > 1 ? 's' : '');
    return '<li class="' + cls + '">' + icon + ' ' + esc(d.title) + ' is due ' + when + '.</li>';
  }).join('');
}

// --- "Next Up" panel on dashboard ---
function renderNextDeadline() {
  const box = document.getElementById('next-deadline');
  const next = deadlines
    .filter(function (d) { return !d.completed && daysUntil(d.date) >= 0; })
    .sort(function (a, b) { return a.date.localeCompare(b.date); })[0];

  if (!next) {
    box.innerHTML = '<div class="empty-state">Nothing scheduled yet.<br>Add your first deadline!</div>';
    return;
  }

  box.innerHTML =
    '<div class="next-deadline-card">' +
      '<span class="badge badge-cat">' + esc(next.category) + '</span>' +
      '<h3 style="margin:8px 0 4px">' + esc(next.title) + '</h3>' +
      '<div class="big-date">' + formatDate(next.date) + '</div>' +
      '<p class="countdown" style="margin-top:6px">' + countdownText(next) + '</p>' +
    '</div>';
}

// --- The deadline cards on the Deadlines page ---
function renderDeadlineList() {
  const grid = document.getElementById('deadline-list');
  const items = getFilteredDeadlines();      // sorted + filtered

  if (items.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">' +
      (deadlines.length === 0
        ? 'No deadlines yet. Add one using the form! ➕'
        : 'No deadlines match your search / filters. 🔍') +
      '</div>';
    return;
  }

  grid.innerHTML = items.map(function (d) {
    const status = getStatus(d);
    const cls = status.toLowerCase().replace(' ', '-');   // e.g. "due-soon"
    return '' +
    '<div class="deadline-card status-' + cls + (d.completed ? ' completed' : '') + '">' +
      '<div class="card-top">' +
        '<span class="badge badge-cat">' + esc(d.category) + '</span>' +
        '<span class="badge status-' + cls + '">' + status + '</span>' +
      '</div>' +
      '<h3>' + esc(d.title) + '</h3>' +
      '<p class="due">Due: ' + formatDate(d.date) + '</p>' +
      '<p class="countdown">' + countdownText(d) + '</p>' +
      (d.description ? '<p class="desc">' + esc(d.description) + '</p>' : '') +
      '<div class="card-actions">' +
        '<button class="action-btn complete" data-action="complete" data-id="' + d.id + '">' +
          (d.completed ? '↩ Undo' : '✓ Mark Complete') + '</button>' +
        '<button class="action-btn delete" data-action="delete" data-id="' + d.id + '">🗑 Delete</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

/* ================= 5. FILTER / SEARCH / SORT ================= */

function getFilteredDeadlines() {
  const search   = document.getElementById('search-input').value.toLowerCase();
  const category = document.getElementById('filter-category').value;
  const status   = document.getElementById('filter-status').value;

  return deadlines
    .filter(function (d) {
      const matchesSearch   = d.title.toLowerCase().includes(search);
      const matchesCategory = category === 'All' || d.category === category;
      const matchesStatus   = status === 'All' || getStatus(d) === status;
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort(function (a, b) {
      // incomplete first, then by nearest date
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.date.localeCompare(b.date);
    });
}

['search-input', 'filter-category', 'filter-status'].forEach(function (id) {
  document.getElementById(id).addEventListener('input', renderDeadlineList);
});

// Complete / Delete buttons (event delegation - one listener for all cards)
document.getElementById('deadline-list').addEventListener('click', function (e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === 'delete') {
    if (confirm('Delete this deadline?')) deleteDeadline(id);
  } else {
    toggleComplete(id);
    showToast(btn.textContent.includes('Undo') ? 'Marked as not completed' : '🎉 Nice! Deadline completed');
  }
});

/* ================= 6. SMART DEADLINE EXTRACTION =================
   This is a RULE-BASED prototype (no AI/API connected).
   It finds dates in common formats and guesses the category from
   keywords. To plug in a real AI later, replace extractDeadlines()
   with a fetch() call to your API and keep everything else the same.
   ---------------------------------------------------------------- */

const MONTH_NUM = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};
const MONTH_PREFIXES = Object.keys(MONTH_NUM).join('|');

// Category rules: first match with the most keywords wins
const CATEGORY_RULES = [
  { category: 'Exam',         words: ['exam', 'examination', 'test', 'quiz', 'midterm', 'internal'] },
  { category: 'Registration', words: ['registration', 'register', 'enroll', 'enrol', 'closes', 'closing', 'last date'] },
  { category: 'Project',      words: ['project'] },
  { category: 'Event',        words: ['event', 'workshop', 'seminar', 'webinar', 'fest', 'hackathon', 'meet', 'competition', 'symposium'] },
  { category: 'Assignment',   words: ['assignment', 'homework', 'submit', 'submission', 'due', 'deadline', 'report', 'lab record'] }
];

// Pick the category that matches the most keywords
function detectCategory(line) {
  const text = line.toLowerCase();
  let best = 'Other';
  let bestScore = 0;
  CATEGORY_RULES.forEach(function (rule) {
    let score = 0;
    rule.words.forEach(function (w) { if (text.includes(w)) score++; });
    if (score > bestScore) { bestScore = score; best = rule.category; }
  });
  return best;
}

// If no year is written, use the current year;
// if that date is already well past, use next year instead.
function resolveYear(month, day, year) {
  const now = new Date();
  let y = year ? Number(year) : now.getFullYear();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const candidate = new Date(y, month, day);
  const diffDays = (today - candidate) / 86400000;
  if (!year && diffDays > 60) y = y + 1;
  return y;
}

// Look for a date inside one line of text.
// Returns { y, m, d, index, length } or null.
function findDateInLine(line) {
  const patterns = [
    // 2026-09-28 (ISO)
    { re: /(\d{4})-(\d{1,2})-(\d{1,2})/, use: function (m) { return { y: +m[1], m: +m[2] - 1, d: +m[3] }; } },
    // September 28 / Sept 28, 2026
    { re: new RegExp('\\b(' + MONTH_PREFIXES + ')[a-z]*\\b\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?', 'i'),
      use: function (m) { return { y: resolveYear(MONTH_NUM[m[1].slice(0, 3).toLowerCase()], +m[2], m[3]), m: MONTH_NUM[m[1].slice(0, 3).toLowerCase()], d: +m[2] }; } },
    // 28 September / 28th of September 2026
    { re: new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(' + MONTH_PREFIXES + ')[a-z]*\\b(?:,?\\s+(\\d{4}))?', 'i'),
      use: function (m) { return { y: resolveYear(MONTH_NUM[m[2].slice(0, 3).toLowerCase()], +m[1], m[3]), m: MONTH_NUM[m[2].slice(0, 3).toLowerCase()], d: +m[1] }; } },
    // 28/09/2026 or 28-09-2026 (assumes day/month/year)
    { re: /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/,
      use: function (m) { return { y: (+m[3] < 100 ? 2000 + Number(m[3]) : +m[3]) , m: +m[2] - 1, d: +m[1] }; } }
  ];

  // Try every pattern, keep the match that appears earliest in the line
  let best = null;
  patterns.forEach(function (p) {
    const m = p.re.exec(line);
    if (m) {
      const info = p.use(m);
      info.index = m.index;
      info.length = m[0].length;
      if (!best || info.index < best.index) best = info;
    }
  });
  return best;
}

// Turn messy announcement text into a clean title
function cleanTitle(raw) {
  let t = raw
    .replace(/^(the|a|an|please|note|reminder|attention)\b[:\s]*/i, '')
    .replace(/\b(must be submitted|will be (held|conducted|organized|organised)|is scheduled|closes|ends|is due|deadline|submit by|submission)( on| by| for)?\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\b(on|by|the|for|in)\b[.\s]*$/i, '')
    .replace(/[.:\s]+$/g, '')
    .trim();
  if (!t) return '';
  // Capitalize each word
  return t.replace(/\w\S*/g, function (w) { return w[0].toUpperCase() + w.slice(1); });
}

// Main extraction function: text -> array of { title, date, category }
function extractDeadlines(text) {
  const results = [];
  // Split the pasted text into sentences / lines
  const lines = text.split(/\n+|(?<=[.!?])\s+/);

  lines.forEach(function (line) {
    line = line.trim();
    if (line.length < 5) return;

    const found = findDateInLine(line);
    if (!found) return;

    // Build an ISO date string YYYY-MM-DD
    const iso = new Date(Date.UTC(found.y, found.m, found.d)).toISOString().slice(0, 10);

    // Title = the line with the date part removed, then cleaned
    let rawTitle = (line.slice(0, found.index) + ' ' + line.slice(found.index + found.length)).trim();
    let title = cleanTitle(rawTitle);
    if (!title) title = detectCategory(line) + ' Deadline';

    results.push({ title: title, date: iso, category: detectCategory(line) });
  });

  return results;
}

// Extract button
let extractedItems = [];   // temporary list shown before the user confirms

document.getElementById('extract-btn').addEventListener('click', function () {
  const text = document.getElementById('extract-input').value;
  const box = document.getElementById('extract-results');

  if (!text.trim()) {
    box.innerHTML = '<p class="empty-state">Please paste an announcement first. 📋</p>';
    return;
  }

  extractedItems = extractDeadlines(text);

  if (extractedItems.length === 0) {
    box.innerHTML = '<p class="empty-state">No dates found. Try including a date like "September 28" or "28/09/2026".</p>';
    return;
  }

  box.innerHTML = extractedItems.map(function (item, i) {
    return '' +
    '<div class="extract-result">' +
      '<span class="er-title">' + esc(item.title) + '</span>' +
      '<span class="er-date">📅 ' + formatDate(item.date) + '</span>' +
      '<span class="badge badge-cat">' + esc(item.category) + '</span>' +
      '<button class="btn btn-primary" data-add-index="' + i + '">＋ Add</button>' +
    '</div>';
  }).join('') +
  '<p class="extract-note">💡 Rule-based demo: recognizes common date formats + keywords (assignment, exam, registration, closes, due...). An AI API can be connected later.</p>';
});

// "Add" button on each extracted item
document.getElementById('extract-results').addEventListener('click', function (e) {
  const btn = e.target.closest('button[data-add-index]');
  if (!btn) return;
  const item = extractedItems[Number(btn.dataset.addIndex)];
  addDeadline(item.title, item.date, item.category, '');
  btn.disabled = true;
  btn.textContent = '✓ Added';
  showToast('"' + item.title + '" added to your deadlines 🎉');
});

/* ================= 7. NAVIGATION, FORM, STARTUP ================= */

// Simple tab navigation between the 3 pages
document.querySelectorAll('.nav-tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    document.querySelectorAll('.nav-tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
    tab.classList.add('active');
    document.getElementById(tab.dataset.target).classList.add('active');
  });
});

// Manual "Add Deadline" form
document.getElementById('deadline-form').addEventListener('submit', function (e) {
  e.preventDefault();
  const title = document.getElementById('f-title').value.trim();
  const date  = document.getElementById('f-date').value;
  const cat   = document.getElementById('f-category').value;
  const desc  = document.getElementById('f-desc').value.trim();
  if (!title || !date) return;

  addDeadline(title, date, cat, desc);
  this.reset();                       // clear the form
  showToast('Deadline added! 📌');
});

// Sample data helper (handy for the hackathon demo)
function loadSampleData() {
  addDeadline('C Programming Assignment', '2026-09-28', 'Assignment', 'Chapter 4 & 5 programs');
  addDeadline('Mathematics Internal Examination', '2026-09-30', 'Exam', 'Syllabus: units 1–3');
  addDeadline('Hackathon Registration', '2026-10-02', 'Registration', 'Register on the college portal');
}

// Small popup message at the bottom of the screen
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.add('hidden'); }, 2500);
}

// ----- START THE APP -----
showCorrectScreen();
renderAll();
