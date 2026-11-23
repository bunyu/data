// Progress is stored on this device (localStorage) and, when sync is on, in a private GitHub Gist (see sync.js).
const KEY = 'hsk1:v1';
const DAY = 864e5;
// Spaced-repetition intervals (days) per box. Box 0 = new.
const INTERVALS = [0, 1, 3, 7, 14, 30, 60];

const defaults = () => ({
  settings: { pinyin: false, meaning: false, rate: 0.8, newPerDay: 10, cardFront: 'hanzi', voice: '', dailyGoal: 20, readMode: false },
  srs: {},          // vocabId -> { box, due, reps, lapses }
  scores: {},       // lessonId -> best % in practice
  written: {},      // char -> times completed
  daily: { date: '', newCount: 0, reviewed: 0 },
  mistakes: {},     // key -> { q, lesson, wrong, streak, at, cleared? }
  last: null,       // last opened lesson id
  epoch: 0,         // set when progress is reset or restored, so sync replaces instead of merging
});

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') {
      const d = defaults();
      return { ...d, ...raw, settings: { ...d.settings, ...raw.settings } };
    }
  } catch { /* storage unavailable or corrupt */ }
  return defaults();
}

let state = load();
const listeners = new Set();
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach((fn) => fn());
};
// Local calendar day, so "today" turns over at the learner's midnight.
export const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 10);
const rollDay = () => { if (state.daily.date !== today()) state.daily = { date: today(), newCount: 0, reviewed: 0 }; };

export const store = {
  get: () => state,
  settings: () => state.settings,
  update(fn) { fn(state); save(); },
  reset() { state = { ...defaults(), epoch: Date.now() }; save(); },
  /** Called after every change (used by sync). */
  onChange(fn) { listeners.add(fn); },
  /** Replace all progress (sync), keeping this device's settings. */
  replace(next) { state = { ...defaults(), ...next, settings: state.settings }; save(); },
  export: () => JSON.stringify(state, null, 2),
  import(json) {
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object' || !data.srs) throw new Error('invalid');
    state = { ...defaults(), ...data, settings: { ...defaults().settings, ...data.settings }, epoch: Date.now() };
    save();
  },
};

export const srs = {
  card: (id) => state.srs[id],
  isDue: (id, now = Date.now()) => !!state.srs[id] && state.srs[id].due <= now,
  newLeftToday() {
    if (state.daily.date !== today()) return state.settings.newPerDay;
    return Math.max(0, state.settings.newPerDay - state.daily.newCount);
  },
  reviewedToday: () => (state.daily.date === today() ? state.daily.reviewed || 0 : 0),
  /** grade: 'again' | 'hard' | 'good' */
  grade(id, grade) {
    const now = Date.now();
    let c = state.srs[id];
    rollDay();
    if (!c) {
      c = { box: 0, due: now, reps: 0, lapses: 0 };
      state.daily.newCount++;
    }
    state.daily.reviewed = (state.daily.reviewed || 0) + 1;
    c.reps++;
    c.at = now;
    if (grade === 'again') {
      c.box = 1; c.lapses++; c.due = now + 10 * 60e3;
    } else if (grade === 'hard') {
      c.box = Math.max(1, c.box);
      c.due = now + Math.max(0.5, INTERVALS[c.box] / 2) * DAY;
    } else {
      c.box = Math.min(INTERVALS.length - 1, c.box + 1);
      c.due = now + INTERVALS[c.box] * DAY;
    }
    state.srs[id] = c;
    save();
    return c;
  },
  /** Human label for the next interval if graded now, e.g. "3 ngày". */
  preview(id, grade) {
    const c = state.srs[id] || { box: 0 };
    let days;
    if (grade === 'again') return '10 phút';
    if (grade === 'hard') days = Math.max(0.5, INTERVALS[Math.max(1, c.box)] / 2);
    else days = INTERVALS[Math.min(INTERVALS.length - 1, c.box + 1)];
    return days < 1 ? '12 giờ' : `${days} ngày`;
  },
  stats(allIds) {
    const now = Date.now();
    let learned = 0, due = 0, mastered = 0;
    for (const id of allIds) {
      const c = state.srs[id];
      if (!c) continue;
      learned++;
      if (c.due <= now) due++;
      if (c.box >= 4) mastered++;
    }
    return { learned, due, mastered, total: allIds.length };
  },
};

/* Mistake notebook: every wrong answer is kept until it is answered right twice in a row. */
const RIGHT_TO_CLEAR = 2;
export const mistakes = {
  record(key, q, lesson, ok) {
    const m = state.mistakes[key];
    const now = Date.now();
    if (!ok) {
      state.mistakes[key] = { q, lesson, wrong: (m && !m.cleared ? m.wrong : 0) + 1, streak: 0, at: now };
    } else if (m && !m.cleared) {
      m.streak++;
      m.at = now;
      // Keep a cleared marker so sync doesn't bring the mistake back from another device.
      if (m.streak >= RIGHT_TO_CLEAR) state.mistakes[key] = { cleared: true, at: now };
    } else return;
    save();
  },
  open: () => Object.entries(state.mistakes).filter(([, m]) => !m.cleared).map(([key, m]) => ({ key, ...m })),
  count: () => Object.values(state.mistakes).filter((m) => !m.cleared).length,
};
