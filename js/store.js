// Progress is stored on this device only (localStorage).
const KEY = 'hsk1:v1';
const DAY = 864e5;
// Spaced-repetition intervals (days) per box. Box 0 = new.
const INTERVALS = [0, 1, 3, 7, 14, 30, 60];

const defaults = () => ({
  settings: { pinyin: false, meaning: false, rate: 0.8, newPerDay: 10, cardFront: 'hanzi' },
  srs: {},          // vocabId -> { box, due, reps, lapses }
  scores: {},       // lessonId -> best % in practice
  written: {},      // char -> times completed
  daily: { date: '', newCount: 0 },
  last: null,       // last opened lesson id
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
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } };
const today = () => new Date().toISOString().slice(0, 10);

export const store = {
  get: () => state,
  settings: () => state.settings,
  update(fn) { fn(state); save(); },
  reset() { state = defaults(); save(); },
  export: () => JSON.stringify(state, null, 2),
  import(json) {
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object' || !data.srs) throw new Error('invalid');
    state = { ...defaults(), ...data, settings: { ...defaults().settings, ...data.settings } };
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
  /** grade: 'again' | 'hard' | 'good' */
  grade(id, grade) {
    const now = Date.now();
    let c = state.srs[id];
    if (!c) {
      c = { box: 0, due: now, reps: 0, lapses: 0 };
      if (state.daily.date !== today()) state.daily = { date: today(), newCount: 0 };
      state.daily.newCount++;
    }
    c.reps++;
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
