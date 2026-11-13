// Handwriting practice with Hanzi Writer (stroke order animation + tracing quiz).
import { h, icon, reveal, backLink, HAN } from './ui.js';
import { store } from './store.js';
import { getReadyLessons } from './data.js';
import { speak } from './audio.js';

let libPromise;
function loadLib() {
  libPromise ??= new Promise((resolve, reject) => {
    if (window.HanziWriter) return resolve(window.HanziWriter);
    const s = document.createElement('script');
    s.src = 'vendor/hanzi-writer/hanzi-writer.min.js';
    s.onload = () => resolve(window.HanziWriter);
    s.onerror = () => { libPromise = null; reject(new Error('Không tải được Hanzi Writer')); };
    document.head.append(s);
  });
  return libPromise;
}

// Stroke data: bundled copy first (works offline), CDN as a fallback.
async function charData(ch) {
  for (const url of [`vendor/hanzi-data/${ch}.json`, `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${ch}.json`]) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch { /* try next */ }
  }
  throw new Error(`Chưa có dữ liệu nét cho chữ ${ch}`);
}

async function charIndex() {
  const lessons = await getReadyLessons();
  const seen = new Set();
  return lessons.map((l) => {
    const chars = [];
    for (const w of l.vocab) for (const ch of w.hanzi.match(HAN) || []) {
      if (!seen.has(ch)) { seen.add(ch); chars.push(ch); }
    }
    return { lesson: l, chars };
  });
}

export async function writeIndexView() {
  const groups = await charIndex();
  const written = store.get().written;
  return h('div', null,
    h('div', { class: 'page-head' }, h('h1', null, 'Luyện viết')),
    h('p', { class: 'muted small', style: 'margin-top:0' }, 'Chọn một chữ để xem thứ tự nét và tập viết bằng ngón tay.'),
    groups.map(({ lesson, chars }) => h('section', null,
      h('div', { class: 'eyebrow' }, `Bài ${lesson.id} · ${lesson.zh}`),
      h('div', { class: 'char-grid' }, chars.map((ch) => h('a', { href: `#/write/${encodeURIComponent(ch)}`, class: written[ch] ? 'practiced' : '', 'aria-label': `Luyện viết chữ ${ch}` }, ch))))));
}

// 米字格 practice grid behind the character.
function gridSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'grid');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<line x1="0" y1="0" x2="100" y2="100"/><line x1="100" y1="0" x2="0" y2="100"/><line x1="50" y1="0" x2="50" y2="100"/><line x1="0" y1="50" x2="100" y2="50"/>';
  return svg;
}

/** #/write/<chars>?i=<index>. Several characters = practise a whole word. */
export async function writeCharView(chars, params) {
  const groups = await charIndex();
  const all = groups.flatMap((g) => g.chars);
  const list = [...chars].filter((c) => /[一-鿿]/.test(c));
  const word = list.length > 1;
  const seq = word ? list : all;
  let i = word ? Number(params.get('i') || 0) : Math.max(0, all.indexOf(list[0]));
  const ch = seq[i] ?? list[0];
  const href = (k) => word ? `#/write/${encodeURIComponent(chars)}?i=${k}` : `#/write/${encodeURIComponent(seq[k])}`;

  // Words (from the lessons) that contain this character.
  const words = groups.flatMap((g) => g.lesson.vocab).filter((w) => w.hanzi.includes(ch)).slice(0, 3);

  const status = h('div', { class: 'writer-status', role: 'status' }, 'Đang tải…');
  const target = h('div', { id: 'writer' });
  const box = h('div', { class: 'writer-box' },
    gridSvg(),
    target);
  const btnAnim = h('button', { class: 'btn', type: 'button', disabled: true }, 'Xem nét');
  const btnQuiz = h('button', { class: 'btn btn-primary', type: 'button', disabled: true }, 'Tự viết');
  const btnOutline = h('button', { class: 'btn', type: 'button', disabled: true, 'aria-pressed': 'true' }, 'Ẩn mẫu');

  const root = h('div', null,
    h('div', { class: 'page-head' }, backLink('#/write'), h('h1', null, 'Luyện viết'),
      word && h('span', { class: 'muted small', style: 'margin-left:auto' }, `${i + 1}/${seq.length}`)),
    h('div', { class: 'writer-info' },
      words.map((w) => h('div', null,
        h('span', { class: 'hz-words' }, w.hanzi), ' ',
        reveal(w.pinyin, 'pinyin', 'py'), ' ',
        reveal(w.vi, 'meaning')))),
    box, status,
    h('div', { class: 'writer-controls' }, btnAnim, btnQuiz, btnOutline),
    h('div', { class: 'writer-nav' },
      i > 0 ? h('a', { class: 'btn', href: href(i - 1) }, `← ${seq[i - 1]}`) : h('span'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Nghe', onClick: () => speak(ch) }, icon('speaker')),
      i < seq.length - 1 ? h('a', { class: 'btn', href: href(i + 1) }, `${seq[i + 1]} →`) : h('span')));

  // Mount after the node is in the document so sizes are known.
  requestAnimationFrame(async () => {
    try {
      const HanziWriter = await loadLib();
      const size = Math.round(box.clientWidth) || 300;
      const css = getComputedStyle(document.documentElement);
      const writer = HanziWriter.create(target, ch, {
        width: size, height: size, padding: Math.round(size * 0.06),
        strokeColor: css.getPropertyValue('--ink').trim() || '#1c1c1e',
        radicalColor: null,
        outlineColor: css.getPropertyValue('--mask').trim() || '#ddd',
        drawingColor: css.getPropertyValue('--accent').trim() || '#a33a2c',
        highlightColor: css.getPropertyValue('--accent').trim() || '#a33a2c',
        strokeAnimationSpeed: 1, delayBetweenStrokes: 250,
        showHintAfterMisses: 3,
        charDataLoader: (c, onLoad, onError) => charData(c).then(onLoad, onError),
        onLoadCharDataSuccess: (d) => { status.textContent = `${d.strokes.length} nét`; [btnAnim, btnQuiz, btnOutline].forEach((b) => { b.disabled = false; }); },
        onLoadCharDataError: (e) => { status.textContent = e?.message || 'Không tải được dữ liệu nét chữ.'; },
      });
      let outline = true;
      btnAnim.addEventListener('click', () => { writer.cancelQuiz(); writer.showCharacter(); writer.animateCharacter(); });
      btnOutline.addEventListener('click', () => {
        outline = !outline;
        outline ? writer.showOutline() : writer.hideOutline();
        btnOutline.textContent = outline ? 'Ẩn mẫu' : 'Hiện mẫu';
        btnOutline.setAttribute('aria-pressed', String(outline));
      });
      btnQuiz.addEventListener('click', () => {
        writer.hideCharacter();
        status.textContent = 'Viết từng nét theo đúng thứ tự.';
        writer.quiz({
          onMistake: (d) => { status.textContent = `Chưa đúng nét ${d.strokeNum + 1}. ${d.mistakesOnStroke >= 3 ? 'Xem gợi ý.' : 'Thử lại.'}`; },
          onCorrectStroke: (d) => { status.textContent = `Nét ${d.strokeNum + 1}/${d.strokeNum + 1 + d.strokesRemaining}`; },
          onComplete: (d) => {
            status.textContent = d.totalMistakes === 0 ? 'Hoàn hảo — không sai nét nào.' : `Hoàn thành · ${d.totalMistakes} lần sai`;
            store.update((s) => { s.written[ch] = (s.written[ch] || 0) + 1; });
          },
        });
      });
    } catch (e) {
      status.textContent = e.message;
    }
  });
  return root;
}
