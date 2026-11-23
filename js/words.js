// Word list with search, and the word sheet used by reading mode.
import { h, icon, backLink, POS, HAN } from './ui.js';
import { srs } from './store.js';
import { getAllVocab, getCourse } from './data.js';
import { speak, bindPlay } from './audio.js';
import { fold, toNumbered } from './pinyin.js';

const writeHref = (w) => `#/write/${encodeURIComponent(w.hanzi.match(HAN)?.join('') || '')}`;
const speakBtn = (text) => bindPlay(h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Nghe ${text}` }, icon('speaker')), () => speak(text));

/** Does a word match the search text? Hanzi, pinyin (marks, numbers or plain) or Vietnamese, accents optional. */
function matches(w, q) {
  if (!q) return true;
  if (/[一-鿿]/.test(q)) return w.hanzi.includes(q);
  const f = fold(q).replace(/\s+/g, ' ').trim();
  const plain = f.replace(/[\s\d]/g, '');
  const py = fold(w.pinyin).replace(/[^a-z]/g, '');
  if (/\d/.test(q)) return toNumbered(w.pinyin).startsWith(toNumbered(q)) || toNumbered(w.pinyin, true).startsWith(toNumbered(q));
  return py.startsWith(plain) || fold(w.vi).includes(f) || (plain.length > 2 && py.includes(plain));
}

export async function wordsView(params) {
  const vocab = await getAllVocab();
  const course = await getCourse();
  const title = (id) => course.lessons.find((l) => l.id === id);
  const input = h('input', { class: 'search', type: 'search', placeholder: 'Tìm chữ Hán, pinyin hoặc nghĩa', 'aria-label': 'Tìm từ', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  input.value = params.get('q') || '';
  const count = h('p', { class: 'small muted', role: 'status' });
  const list = h('div');

  const row = (w) => {
    const c = srs.card(w.id);
    return h('li', { class: 'wl-row' },
      h('button', { class: 'wl-main', type: 'button', onClick: () => openSheet(w) },
        h('span', { class: 'zh hz' }, w.hanzi),
        h('span', { class: 'py' }, w.pinyin),
        h('span', { class: 'vi' }, w.vi)),
      c ? h('span', { class: `dot ${c.box >= 4 ? 'mastered' : ''}`, title: c.box >= 4 ? 'Đã thuộc' : 'Đã học' }) : h('span', { class: 'dot empty' }),
      speakBtn(w.hanzi));
  };

  function render() {
    const q = input.value.trim();
    const found = vocab.filter((w) => matches(w, q));
    count.textContent = q ? `${found.length} từ` : `${vocab.length} từ trong ${new Set(vocab.map((w) => w.lesson)).size} bài`;
    const groups = new Map();
    for (const w of found) groups.set(w.lesson, [...(groups.get(w.lesson) || []), w]);
    list.replaceChildren(...[...groups].map(([id, ws]) => h('section', null,
      h('a', { class: 'eyebrow wl-head', href: `#/lesson/${id}` }, `Bài ${id} · ${title(id)?.vi || ''}`),
      h('ul', { class: 'list-card wl' }, ws.map(row)))),
    found.length ? '' : h('div', { class: 'empty' }, 'Không tìm thấy từ nào.'));
  }
  input.addEventListener('input', () => {
    render();
    history.replaceState(null, '', `#/words${input.value.trim() ? `?q=${encodeURIComponent(input.value.trim())}` : ''}`);
  });
  render();

  return h('div', null,
    h('div', { class: 'page-head' }, backLink('#/'), h('h1', null, 'Danh sách từ')),
    input, count, list,
    h('p', { class: 'small muted' }, 'Gõ pinyin không dấu (hao), có số (hao3) hoặc tiếng Việt không dấu (tot).'));
}

/* ------------------------------------------------------------ Word sheet */
let sheetEl = null;
export function closeSheet() {
  sheetEl?.remove();
  sheetEl = null;
}

/** Bottom sheet with a word's pinyin, meaning and actions. */
export function openSheet(w) {
  closeSheet();
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': w.hanzi },
    h('div', { class: 'sheet-top' },
      h('span', { class: 'zh hz' }, w.hanzi),
      speakBtn(w.hanzi),
      h('button', { class: 'icon-btn sheet-close', type: 'button', 'aria-label': 'Đóng', onClick: closeSheet }, '×')),
    h('div', { class: 'py' }, w.pinyin),
    h('div', { class: 'vi' }, w.vi, w.pos ? h('span', { class: 'pos' }, POS[w.pos] || w.pos) : null),
    h('div', { class: 'btn-row', style: 'margin-top:14px' },
      h('a', { class: 'btn', href: writeHref(w), onClick: closeSheet }, icon('pen'), 'Luyện viết'),
      w.lesson && h('a', { class: 'btn', href: `#/lesson/${w.lesson}`, onClick: closeSheet }, `Bài ${w.lesson}`)));
  sheetEl = h('div', { class: 'sheet-wrap', onClick: (e) => { if (e.target === sheetEl) closeSheet(); } }, panel);
  document.body.append(sheetEl);
  speak(w.hanzi);
  panel.querySelector('.sheet-close').focus({ preventScroll: true });
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

/* ----------------------------------------------------------- Segmenting */
/** Split Chinese text into known words (longest match first); other characters stay single. */
export function segment(text, vocab) {
  const dict = new Map();
  let longest = 1;
  for (const w of vocab) {
    const key = w.hanzi.replace(/[（(].*?[)）]/g, '').trim();
    if (!key || !/[一-鿿]/.test(key)) continue;
    if (!dict.has(key)) dict.set(key, w);
    longest = Math.max(longest, key.length);
  }
  const out = [];
  let i = 0;
  while (i < text.length) {
    let hit = null;
    for (let len = Math.min(longest, text.length - i); len > 0; len--) {
      const piece = text.slice(i, i + len);
      if (dict.has(piece)) { hit = piece; break; }
    }
    if (hit) { out.push({ text: hit, word: dict.get(hit) }); i += hit.length; }
    else { out.push({ text: text[i] }); i++; }
  }
  return out;
}
