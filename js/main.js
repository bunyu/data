import { h, icon, reveal, revealToggles, backLink, POS } from './ui.js';
import { store, srs } from './store.js';
import { getCourse, getLesson, getAllVocab } from './data.js';
import { speak, playTrack, bindPlay, stop } from './audio.js';
import { runExercises, vocabDrills } from './exercises.js';
import { reviewView } from './review.js';
import { writeIndexView, writeCharView } from './write.js';

const view = document.getElementById('view');

const speakBtn = (text, label = 'Nghe') =>
  bindPlay(h('button', { class: 'icon-btn', type: 'button', 'aria-label': label }, icon('speaker')), () => speak(text));

/* ------------------------------------------------------------------ Home */
async function homeView() {
  const course = await getCourse();
  const vocab = await getAllVocab();
  const st = srs.stats(vocab.map((w) => w.id));
  const scores = store.get().scores;
  const last = store.get().last;
  const newLeft = Math.min(srs.newLeftToday(), vocab.filter((w) => !srs.card(w.id)).length);

  const lastMeta = last && course.lessons.find((l) => l.id === last);
  return h('div', null,
    h('header', { class: 'hero' },
      h('h1', null, 'HSK 1'),
      h('p', null, `${course.title} · ${course.subtitle}`)),
    h('div', { class: 'summary' },
      h('a', { class: 'card', href: '#/review' },
        h('div', { class: 'num' }, st.due + newLeft),
        h('div', { class: 'lbl' }, 'thẻ cần ôn hôm nay')),
      h('a', { class: 'card', href: '#/settings' },
        h('div', { class: 'num' }, `${st.learned}`),
        h('div', { class: 'lbl' }, `/ ${st.total} từ đã học`))),
    lastMeta && h('div', null,
      h('div', { class: 'eyebrow' }, 'Tiếp tục'),
      h('a', { class: 'card lesson-row', href: `#/lesson/${lastMeta.id}`, style: 'padding:14px 16px' },
        h('span', { class: 'n' }, lastMeta.id),
        h('span', { class: 't' }, h('div', { class: 'zh' }, lastMeta.zh), h('div', { class: 'vi' }, lastMeta.vi)),
        h('span', { class: 'state' }, icon('chevron')))),
    h('div', { class: 'eyebrow' }, 'Các bài học'),
    h('ul', { class: 'lesson-list' }, course.lessons.map((l) => h('li', null,
      h(l.file ? 'a' : 'div', { class: `lesson-row ${l.file ? '' : 'locked'}`, href: l.file ? `#/lesson/${l.id}` : null },
        h('span', { class: 'n' }, String(l.id).padStart(2, '0')),
        h('span', { class: 't' }, h('div', { class: 'zh' }, l.zh), h('div', { class: 'vi' }, l.vi)),
        h('span', { class: 'state' }, !l.file ? 'Sắp có' : scores[l.id] != null ? h('span', { class: 'done' }, `${scores[l.id]}%`) : '')))))
  );
}

/* ---------------------------------------------------------------- Lesson */
const TABS = [['vocab', 'Từ vựng'], ['texts', 'Bài khoá'], ['grammar', 'Ngữ pháp'], ['practice', 'Luyện tập']];

async function lessonView(id, tab = 'vocab') {
  const lesson = await getLesson(id);
  if (!lesson) return h('div', { class: 'empty' }, 'Không tìm thấy bài học.');

  const head = h('div', null,
    h('div', { class: 'page-head' }, backLink('#/'), h('span', { class: 'muted small' }, `Bài ${lesson.id}`)),
    h('div', { class: 'lesson-title' },
      h('div', { class: 'zh' }, lesson.zh),
      lesson.pinyin && h('div', null, reveal(lesson.pinyin, 'pinyin')),
      h('div', { class: 'vi' }, lesson.vi)));

  if (!lesson.ready) {
    return h('div', null, head,
      h('div', { class: 'card' },
        h('p', { style: 'margin-top:0' }, 'Nội dung bài này đang được nhập từ giáo trình.'),
        lesson.grammar?.length ? h('div', null, h('div', { class: 'muted small' }, 'Ngữ pháp sẽ học:'),
          h('ul', { class: 'outline-list' }, lesson.grammar.map((g) => h('li', null, g)))) : null,
        h('p', { class: 'muted small', style: 'margin-bottom:0' }, `Giáo trình, trang ${lesson.page}.`)));
  }

  store.update((s) => { s.last = lesson.id; });
  const content = h('div');
  const tabs = h('nav', { class: 'tabs', 'aria-label': 'Phần của bài học' },
    TABS.map(([key, label]) => h('a', { href: `#/lesson/${lesson.id}/${key}`, 'aria-current': key === tab ? 'page' : null }, label)));

  const root = h('div', null, head, tabs, content);
  if (tab !== 'practice') content.append(revealToggles(root));

  if (tab === 'vocab') content.append(vocabSection(lesson));
  if (tab === 'texts') content.append(textsSection(lesson));
  if (tab === 'grammar') content.append(grammarSection(lesson));
  if (tab === 'practice') content.append(await practiceSection(lesson));
  return root;
}

function vocabSection(lesson) {
  const words = lesson.vocab;
  const item = (w) => h('li', { class: 'word' },
    h('div', { class: 'hz' }, w.hanzi),
    h('div', { class: 'actions' },
      speakBtn(w.hanzi, `Nghe ${w.hanzi}`),
      h('a', { class: 'icon-btn', href: `#/write/${encodeURIComponent(w.hanzi.match(/[一-鿿]/g)?.join('') || '')}`, 'aria-label': `Luyện viết ${w.hanzi}` }, icon('pen'))),
    h('div', { class: 'meta' },
      reveal(w.pinyin, 'pinyin', 'py'),
      w.pos ? h('span', { class: 'pos' }, POS[w.pos] || w.pos) : null,
      w.proper ? h('span', { class: 'pos' }, 'danh từ riêng') : null,
      h('span', { class: 'vi' }, reveal(w.vi, 'meaning'))));
  return h('div', null,
    h('a', { class: 'btn btn-primary btn-block', href: `#/review?lesson=${lesson.id}` }, icon('cards'), 'Học thẻ từ của bài này'),
    h('div', { class: 'eyebrow' }, `${words.length} từ mới`),
    h('ul', { class: 'vocab' }, words.map(item)));
}

function textsSection(lesson) {
  const blocks = lesson.texts.map((t) => {
    const all = t.lines.map((l) => l.zh).join('');
    return h('section', { class: 'card dialog' },
      h('div', { class: 'head' },
        h('h2', null, t.title),
        h('span', { class: 'muted small' }, t.audio ? `♪ ${t.audio}` : ''),
        bindPlay(h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Nghe cả bài' }, icon('play')), () => playTrack(t.audio, all))),
      t.context && h('p', { class: 'ctx' }, t.context),
      t.lines.map((l) => {
        const who = lesson.speakers?.[l.s];
        return h('div', { class: 'line' },
          h('div', { class: 'who', title: who?.vi }, who && h('span', { class: 'zh' }, who.zh)),
          h('div', null,
            bindPlay(h('button', { class: 'say', type: 'button' }, l.zh), () => speak(l.zh)),
            reveal(l.pinyin, 'pinyin', 'py'),
            reveal(l.vi, 'meaning', 'vi')));
      }),
      t.note && h('div', { class: 'note', style: 'margin-top:8px' }, t.note));
  });

  const r = lesson.rhyme;
  const rhyme = r && h('section', { class: 'card dialog rhyme' },
    h('div', { class: 'head' }, h('h2', null, 'Cùng đọc bài vè'),
      bindPlay(h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Nghe bài vè' }, icon('play')), () => playTrack(r.audio, r.lines.map((l) => l.zh).join('')))),
    r.lines.map((l) => h('div', { style: 'margin-top:8px' },
      bindPlay(h('button', { class: 'say zh', type: 'button', style: 'background:none;border:0;padding:0;cursor:pointer' }, l.zh), () => speak(l.zh)),
      h('div', null, reveal(l.pinyin, 'pinyin', 'py')),
      h('div', { class: 'small' }, reveal(l.vi, 'meaning')))));

  return h('div', { class: 'stack' }, blocks, rhyme,
    h('p', { class: 'muted small' }, 'Chạm vào câu tiếng Trung để nghe. Nút ▶ phát file âm thanh của giáo trình nếu đã có, nếu không sẽ dùng giọng đọc của trình duyệt.'));
}

function grammarSection(lesson) {
  if (!lesson.grammar?.length) return h('div', { class: 'empty' }, 'Bài này không có điểm ngữ pháp mới.');
  return h('div', { class: 'stack' }, lesson.grammar.map((g, i) => h('section', { class: 'card gram' },
    h('div', { class: 'zh-title' }, `${i + 1}. ${g.zh}`),
    h('h2', null, g.vi),
    g.pattern && h('div', { class: 'pattern' }, g.pattern),
    h('p', null, g.explain),
    g.note && h('p', { class: 'muted small' }, g.note),
    g.examples.map((e) => h('div', { class: 'ex' },
      h('div', { class: 'txt' },
        h('span', { class: 'zh' }, e.zh),
        reveal(e.pinyin, 'pinyin', 'py'),
        reveal(e.vi, 'meaning', 'vi')),
      speakBtn(e.zh))))));
}

async function practiceSection(lesson) {
  const pool = await getAllVocab();
  const box = h('div');
  const done = (pct) => store.update((s) => { s.scores[lesson.id] = Math.max(pct, s.scores[lesson.id] ?? 0); });
  const start = (items) => { box.replaceChildren(); runExercises(box, items, { onDone: done }); };
  const counts = (t) => lesson.exercises.filter((e) => t.includes(e.type)).length;
  const item = (title, sub, run) => h('button', { class: 'card menu-item', type: 'button', onClick: run },
    h('span', { class: 't' }, h('b', null, title), h('span', null, sub)), icon('chevron'));

  const best = store.get().scores[lesson.id];
  box.append(h('div', { class: 'menu' },
    item('Bài tập tổng hợp', `${lesson.exercises.length} câu · điền từ, dịch câu, nghe hiểu`, () => start(lesson.exercises)),
    item('Luyện từ vựng', 'Chọn nghĩa, chọn chữ Hán, nghe và chọn từ', () => start(vocabDrills(lesson.vocab, pool, 9))),
    item('Dịch câu', `${counts(['order'])} câu · sắp xếp từ thành câu tiếng Trung`, () => start(lesson.exercises.filter((e) => e.type === 'order'))),
    item('Nghe hiểu', `${counts(['listen'])} câu`, () => start([...lesson.exercises.filter((e) => e.type === 'listen'), ...vocabDrills(lesson.vocab, pool, 12).filter((d) => d.type === 'hear')]))),
    best != null && h('p', { class: 'muted small' }, `Điểm cao nhất: ${best}%`));
  return box;
}

/* -------------------------------------------------------------- Settings */
async function settingsView() {
  const s = store.settings();
  const vocab = await getAllVocab();
  const st = srs.stats(vocab.map((w) => w.id));
  const toggle = (key, title, sub) => {
    const input = h('input', { type: 'checkbox', class: 'switch', 'aria-label': title });
    input.checked = !!s[key];
    input.addEventListener('change', () => store.update((x) => { x.settings[key] = input.checked; }));
    return h('label', { class: 'setting' }, h('span', { class: 't' }, title, h('span', null, sub)), input);
  };
  const rate = h('select', { 'aria-label': 'Tốc độ đọc' },
    [[0.6, 'Chậm'], [0.8, 'Vừa'], [1, 'Bình thường']].map(([v, l]) => h('option', { value: v, selected: Number(s.rate) === v ? true : null }, l)));
  rate.addEventListener('change', () => { store.update((x) => { x.settings.rate = Number(rate.value); }); speak('你好，我叫李文。'); });
  const perDay = h('select', { 'aria-label': 'Số từ mới mỗi ngày' }, [5, 10, 15, 20, 30].map((v) => h('option', { value: v, selected: s.newPerDay === v ? true : null }, v)));
  perDay.addEventListener('change', () => store.update((x) => { x.settings.newPerDay = Number(perDay.value); }));

  const fileIn = h('input', { type: 'file', accept: 'application/json', hidden: true });
  const msg = h('p', { class: 'small muted', role: 'status' });
  fileIn.addEventListener('change', async () => {
    try { store.import(await fileIn.files[0].text()); msg.textContent = 'Đã khôi phục tiến độ.'; } catch { msg.textContent = 'File không hợp lệ.'; }
  });
  const exportBtn = h('button', { class: 'btn', type: 'button' }, 'Sao lưu tiến độ');
  exportBtn.addEventListener('click', () => {
    const a = h('a', { href: URL.createObjectURL(new Blob([store.export()], { type: 'application/json' })), download: `hsk1-tien-do-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
  });
  const resetBtn = h('button', { class: 'btn', type: 'button' }, 'Xoá tiến độ');
  resetBtn.addEventListener('click', () => {
    if (!resetBtn.dataset.armed) { resetBtn.dataset.armed = '1'; resetBtn.textContent = 'Chạm lần nữa để xoá'; return; }
    store.reset(); route();
  });

  return h('div', null,
    h('div', { class: 'page-head' }, h('h1', null, 'Cá nhân')),
    h('div', { class: 'stats' },
      h('div', { class: 'card' }, h('b', null, st.learned), h('span', null, 'từ đã học')),
      h('div', { class: 'card' }, h('b', null, st.mastered), h('span', null, 'từ đã thuộc')),
      h('div', { class: 'card' }, h('b', null, st.due), h('span', null, 'cần ôn'))),
    h('div', { class: 'eyebrow' }, 'Hiển thị'),
    h('div', { class: 'list-card' },
      toggle('pinyin', 'Luôn hiện pinyin', 'Mặc định ẩn, chạm để xem khi quên'),
      toggle('meaning', 'Luôn hiện nghĩa tiếng Việt', 'Mặc định ẩn, chạm để xem khi quên')),
    h('div', { class: 'eyebrow' }, 'Âm thanh & ôn tập'),
    h('div', { class: 'list-card' },
      h('label', { class: 'setting' }, h('span', { class: 't' }, 'Tốc độ giọng đọc', h('span', null, 'Dùng khi chưa có file âm thanh của sách')), rate),
      h('label', { class: 'setting' }, h('span', { class: 't' }, 'Từ mới mỗi ngày', h('span', null, 'Giới hạn thẻ mới trong phần Ôn tập')), perDay)),
    h('div', { class: 'eyebrow' }, 'Dữ liệu'),
    h('p', { class: 'small muted', style: 'margin-top:0' }, 'Tiến độ chỉ được lưu trên thiết bị này. Hãy sao lưu nếu bạn muốn chuyển sang máy khác.'),
    h('div', { class: 'btn-row' }, exportBtn, h('label', { class: 'btn' }, 'Khôi phục', fileIn)),
    h('div', { style: 'margin-top:8px' }, resetBtn),
    msg);
}

/* ---------------------------------------------------------------- Router */
async function updateBadge() {
  const vocab = await getAllVocab();
  const st = srs.stats(vocab.map((w) => w.id));
  const b = document.getElementById('due-badge');
  b.textContent = st.due;
  b.hidden = st.due === 0;
}

async function route() {
  stop();
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);
  let nav = 'home';
  let node;
  try {
    if (parts[0] === 'lesson') node = await lessonView(parts[1], parts[2]);
    else if (parts[0] === 'review') { nav = 'review'; node = await reviewView(params); }
    else if (parts[0] === 'write' && parts[1]) { nav = 'write'; node = await writeCharView(decodeURIComponent(parts[1]), params); }
    else if (parts[0] === 'write') { nav = 'write'; node = await writeIndexView(); }
    else if (parts[0] === 'settings') { nav = 'settings'; node = await settingsView(); }
    else node = await homeView();
  } catch (err) {
    console.error(err);
    node = h('div', { class: 'empty' }, h('p', null, 'Không tải được nội dung.'), h('p', { class: 'small' }, String(err.message || err)));
  }
  view.replaceChildren(node);
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  updateBadge();
}

window.addEventListener('hashchange', route);
route();
