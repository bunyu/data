// Sync progress between devices through a private GitHub Gist.
// The learner pastes a GitHub token that only has the "gist" scope. The token and
// gist id stay on this device (their own localStorage key) and are never uploaded.
import { store } from './store.js';

const META_KEY = 'hsk1:sync';
const FILE = 'hsk1-progress.json';
const API = 'https://api.github.com';
const DEBOUNCE = 3000;

let meta = loadMeta();
let timer = null;
let running = null;
let applying = false;
const listeners = new Set();

function loadMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; }
}
function saveMeta(patch) {
  meta = { ...meta, ...patch };
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* ignore */ }
  listeners.forEach((fn) => fn(syncInfo()));
}

export const syncInfo = () => ({ on: !!meta.token, gistId: meta.gistId, last: meta.last, status: meta.status || '', error: !!meta.error, dirty: !!meta.dirty, pulled: !!meta.pulled });
export const onSyncStatus = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/* ----------------------------------------------------------------- Merge */
const progressOf = (s) => {
  const { settings, ...rest } = s;
  return rest;
};

function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
const same = (a, b) => canonical(a) === canonical(b);

function mergeMap(a = {}, b = {}, pick) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[k] = a[k] === undefined ? b[k] : b[k] === undefined ? a[k] : pick(a[k], b[k]);
  }
  return out;
}

/** Combine two copies of progress so nothing learned on either device is lost. */
export function merge(local, remote) {
  if (!remote) return local;
  // A reset or restore on one device wins over everything older.
  if ((remote.epoch || 0) !== (local.epoch || 0)) return (remote.epoch || 0) > (local.epoch || 0) ? remote : local;
  const later = (x, y) => ((y.at || 0) > (x.at || 0) ? y : x);
  const da = local.daily || {};
  const db = remote.daily || {};
  let daily;
  if (da.date === db.date) daily = { date: da.date, newCount: Math.max(da.newCount || 0, db.newCount || 0), reviewed: Math.max(da.reviewed || 0, db.reviewed || 0) };
  else daily = (da.date || '') > (db.date || '') ? da : db;
  return {
    ...remote,
    ...local,
    srs: mergeMap(local.srs, remote.srs, (x, y) => {
      if ((x.reps || 0) !== (y.reps || 0)) return (y.reps || 0) > (x.reps || 0) ? y : x;
      return (y.at || 0) > (x.at || 0) || ((y.at || 0) === (x.at || 0) && y.due > x.due) ? y : x;
    }),
    scores: mergeMap(local.scores, remote.scores, Math.max),
    written: mergeMap(local.written, remote.written, Math.max),
    mistakes: mergeMap(local.mistakes, remote.mistakes, later),
    daily,
    last: local.last ?? remote.last ?? null,
    epoch: local.epoch || 0,
  };
}

/* ------------------------------------------------------------------- API */
async function gh(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${meta.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const e = new Error('offline');
    e.offline = true;
    throw e;
  }
  if (!res.ok) {
    const e = new Error(`GitHub ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return res.status === 204 ? null : res.json();
}

async function readGist(id) {
  const g = await gh(`/gists/${id}`);
  const f = g.files?.[FILE];
  if (!f) return null;
  let text = f.content;
  if (f.truncated) text = await (await fetch(f.raw_url, { cache: 'no-store' })).text();
  try { return JSON.parse(text); } catch { return null; }
}

const writeGist = (id, data) => gh(`/gists/${id}`, { method: 'PATCH', body: { files: { [FILE]: { content: JSON.stringify(data) } } } });

async function findOrCreateGist() {
  for (let page = 1; page <= 5; page++) {
    const list = await gh(`/gists?per_page=100&page=${page}`);
    const hit = list.find((g) => g.files?.[FILE]);
    if (hit) return hit.id;
    if (list.length < 100) break;
  }
  const g = await gh('/gists', {
    method: 'POST',
    body: { description: 'Tiến độ học HSK 1 (tự động đồng bộ)', public: false, files: { [FILE]: { content: JSON.stringify(progressOf(store.get())) } } },
  });
  return g.id;
}

const errorText = (e) => (e.offline ? 'Không có mạng. Sẽ đồng bộ khi có mạng lại.'
  : e.status === 401 ? 'Token không hợp lệ hoặc đã hết hạn.'
    : e.status === 403 || e.status === 404 ? 'Token không có quyền "gist", hoặc gist đã bị xoá.'
      : `Lỗi đồng bộ (${e.message}).`);

/* ------------------------------------------------------------------ Sync */
/** Pull, merge and push. Safe to call often; concurrent calls share one run. */
export function syncNow() {
  if (!meta.token) return Promise.resolve(false);
  if (running) return running;
  clearTimeout(timer);
  running = (async () => {
    saveMeta({ status: 'Đang đồng bộ…', error: false, pulled: false });
    try {
      if (!meta.gistId) saveMeta({ gistId: await findOrCreateGist() });
      const remote = await readGist(meta.gistId);
      const local = progressOf(store.get());
      const merged = merge(local, remote);
      const pulled = !same(merged, local);
      if (pulled) {
        applying = true;
        try { store.replace(merged); } finally { applying = false; }
      }
      if (!same(merged, remote)) await writeGist(meta.gistId, merged);
      saveMeta({ last: Date.now(), dirty: false, status: 'Đã đồng bộ', error: false, pulled });
      return true;
    } catch (e) {
      if (e.status === 404) saveMeta({ gistId: null });
      saveMeta({ status: errorText(e), error: true });
      return false;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Turn sync on with a token; the first run merges this device with the cloud copy. */
export async function connect(token) {
  saveMeta({ token: token.trim(), gistId: null, last: null, error: false, status: '' });
  const ok = await syncNow();
  if (!ok && meta.error && !meta.gistId) saveMeta({ token: null });
  return ok;
}

export function disconnect() {
  clearTimeout(timer);
  try { localStorage.removeItem(META_KEY); } catch { /* ignore */ }
  meta = {};
  listeners.forEach((fn) => fn(syncInfo()));
}

/** Start listening for changes; call once at startup. */
export function initSync() {
  store.onChange(() => {
    if (applying || !meta.token) return;
    if (!meta.dirty || meta.pulled) saveMeta({ dirty: true, pulled: false });
    clearTimeout(timer);
    timer = setTimeout(syncNow, DEBOUNCE);
  });
  document.addEventListener('visibilitychange', () => {
    if (!meta.token) return;
    // Leaving the app: send pending changes now. Coming back: pick up the other device's work.
    if (document.visibilityState === 'hidden' ? meta.dirty : true) syncNow();
  });
  window.addEventListener('online', () => { if (meta.token) syncNow(); });
  if (meta.token) syncNow();
}
