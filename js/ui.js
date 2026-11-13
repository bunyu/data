import { store } from './store.js';

/** Tiny DOM helper: h('div', {class:'x', onClick: fn}, child, ...) */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const ICONS = {
  speaker: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  pen: '<path d="M4 20l4-1 11-11-3-3L5 16zM14 7l3 3"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  cards: '<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
};
export function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name] || '';
  return s;
}

export function backLink(href, label = 'Quay lại') {
  return h('a', { class: 'back', href, 'aria-label': label }, icon('back'));
}

/**
 * Text hidden behind a tap-to-reveal mask.
 * kind: 'pinyin' | 'meaning'. Default visibility comes from settings.
 */
export function reveal(text, kind, extraClass = '') {
  const s = store.settings();
  const shown = kind === 'pinyin' ? s.pinyin : s.meaning;
  const label = kind === 'pinyin' ? 'Pinyin' : 'Nghĩa';
  const el = h('span', {
    class: `reveal ${extraClass} ${shown ? '' : 'is-hidden'}`.trim(),
    'data-kind': kind,
    'data-label': `Hiện ${label.toLowerCase()}`,
    role: 'button',
    tabindex: '0',
    'aria-label': shown ? undefined : `Hiện ${label.toLowerCase()}`,
  }, text);
  const toggle = (e) => { e.stopPropagation(); el.classList.toggle('is-hidden'); el.removeAttribute('aria-label'); };
  el.addEventListener('click', toggle);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } });
  return el;
}

/** Two chips that reveal / hide every pinyin or meaning on the current page. */
export function revealToggles(root) {
  const s = store.settings();
  const chip = (kind, label, on) => {
    const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(on) }, label);
    b.addEventListener('click', () => {
      const next = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(next));
      root.querySelectorAll(`.reveal[data-kind="${kind}"]`).forEach((r) => r.classList.toggle('is-hidden', !next));
    });
    return b;
  };
  return h('div', { class: 'toggles' },
    h('span', { class: 'lbl' }, 'Hiện tất cả:'),
    chip('pinyin', 'Pinyin', s.pinyin),
    chip('meaning', 'Nghĩa', s.meaning));
}

export const POS = {
  n: 'danh từ', pron: 'đại từ', v: 'động từ', adj: 'tính từ', adv: 'phó từ',
  part: 'trợ từ', interj: 'thán từ', num: 'số từ', mw: 'lượng từ', prep: 'giới từ',
  conj: 'liên từ', suffix: 'hậu tố',
};

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const HAN = /[一-鿿]/g;
