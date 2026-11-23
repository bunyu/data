import { h, icon, reveal, revealToggles, backLink, POS } from './ui.js';
import { store, srs, mistakes } from './store.js';
import { getCourse, getLesson, getAllVocab } from './data.js';
import { speak, speakLines, playTrack, bindPlay, stop, chineseVoices, hasTTS } from './audio.js';
import { runExercises, vocabDrills } from './exercises.js';
import { reviewView } from './review.js';
import { writeIndexView, writeCharView } from './write.js';
import { wordsView, openSheet, closeSheet, segment } from './words.js';
import { tonesView, mistakesView } from './drills.js';
import { initSync, connect, disconnect, syncNow, syncInfo, onSyncStatus } from './sync.js';

const view = document.getElementById('view');

const speakBtn = (text, label = 'Nghe') =>
  bindPlay(h('button', { class: 'icon-btn', type: 'button', 'aria-label': label }, icon('speaker')), () => speak(text));
const SLOW = 0.6;
const slowBtn = (text) =>
  bindPlay(h('button', { class: 'slow-btn', type: 'button', 'aria-label': 'Nghe chậm' }, '0.6×'), () => speak(text, SLOW));

/* ------------------------------------------------------------------ Home */
async function homeView() {
  const course = await getCourse();
  const vocab = await getAllVocab();
  const st = srs.stats(vocab.map((w) => w.id));
  const scores = store.get().scores;
  const last = store.get().last;
  const newLeft = Math.min(srs.newLeftToday(), vocab.filter((w) => !srs.card(w.id)).length);

  const lastMeta = last && course.lessons.find((l) => l.id === last);
  const byLesson = new Map();
  for (const w of vocab) {
    const e = byLesson.get(w.lesson) || { total: 0, learned: 0 };
    e.total++;
    if (srs.card(w.id)) e.learned++;
    byLesson.set(w.lesson, e);
  }
  const goal = store.settings().dailyGoal || 20;
  const doneToday = srs.reviewedToday();
  const openMistakes = mistakes.count();
  const tool = (href, title, sub) => h('a', { class: 'card tool', href }, h('b', null, title), h('span', null, sub));
  const state = (l) => {
    if (!l.file) return 'Sắp có';
    const p = byLesson.get(l.id);
    return h('span', { class: 'lesson-prog' },
      p && h('span', { class: p.learned === p.total ? 'done' : '' }, `${p.learned}/${p.total} từ`),
      scores[l.id] != null && h('span', { class: 'done' }, `${scores[l.id]}%`));
  };
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
    h('a', { class: 'goal', href: '#/review', 'aria-label': `Mục tiêu hôm nay: ${doneToday} trên ${goal} thẻ` },
      h('span', null, `${Math.min(doneToday, goal) === goal ? '✓ ' : ''}${doneToday}/${goal} thẻ hôm nay`),
      h('span', { class: 'goal-bar' }, h('i', { style: `width:${Math.min(100, Math.round((doneToday / goal) * 100))}%` }))),
    h('div', { class: 'tools' },
      tool('#/words', 'Tra từ', `${st.total} từ, tìm nhanh`),
      tool('#/tones', 'Thanh điệu', 'Nghe, gõ pinyin'),
      tool('#/mistakes', 'Sổ lỗi', openMistakes ? `${openMistakes} câu cần làm lại` : 'Chưa có câu sai')),
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
        h('span', { class: 'state' }, state(l))))))
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
  if (tab === 'texts') content.append(textsSection(lesson, await getAllVocab()));
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

function textsSection(lesson, vocab) {
  const box = h('div');
  const render = () => box.replaceChildren(textsContent(lesson, vocab, render));
  render();
  return box;
}

function textsContent(lesson, vocab, rerender) {
  const reading = !!store.settings().readMode;
  const words = [...lesson.vocab.map((w) => ({ ...w, lesson: lesson.id })), ...vocab.filter((w) => w.lesson !== lesson.id)];
  const readBtn = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(reading) }, 'Chế độ đọc');
  readBtn.addEventListener('click', () => { stop(); store.update((s) => { s.settings.readMode = !reading; }); rerender(); });

  // One spoken line: tap to hear it. In reading mode each word is tappable instead.
  const sentence = (zh) => {
    if (!reading) return bindPlay(h('button', { class: 'say', type: 'button' }, zh), () => speak(zh));
    return h('div', { class: 'say reading zh' }, segment(zh, words).map((p) => (p.word
      ? h('button', { class: 'w', type: 'button', onClick: () => openSheet(p.word) }, p.text)
      : h('span', null, p.text))));
  };
  const lineTools = (zh) => h('span', { class: 'line-tools' }, reading ? speakBtn(zh, 'Nghe câu') : null, slowBtn(zh));

  const playAll = (audio, entries) => bindPlay(
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Nghe cả bài' }, icon('play')),
    () => playTrack(audio, () => speakLines(entries)));

  const blocks = lesson.texts.map((t) => {
    const entries = [];
    const lines = t.lines.map((l) => {
      const who = lesson.speakers?.[l.s];
      const el = h('div', { class: 'line' },
        h('div', { class: 'who', title: who?.vi }, who && h('span', { class: 'zh' }, who.zh)),
        h('div', null,
          h('div', { class: 'say-row' }, sentence(l.zh), lineTools(l.zh)),
          !reading && reveal(l.pinyin, 'pinyin', 'py'),
          reveal(l.vi, 'meaning', 'vi')));
      entries.push({ text: l.zh, el });
      return el;
    });
    return h('section', { class: 'card dialog' },
      h('div', { class: 'head' },
        h('h2', null, t.title),
        h('span', { class: 'muted small' }, t.audio ? `♪ ${t.audio}` : ''),
        playAll(t.audio, entries)),
      t.context && h('p', { class: 'ctx' }, t.context),
      lines,
      t.note && h('div', { class: 'note', style: 'margin-top:8px' }, t.note));
  });

  const r = lesson.rhyme;
  let rhyme = null;
  if (r) {
    const entries = [];
    const lines = r.lines.map((l) => {
      const el = h('div', { class: 'rhyme-line' },
        h('div', { class: 'say-row' }, sentence(l.zh), lineTools(l.zh)),
        !reading && h('div', null, reveal(l.pinyin, 'pinyin', 'py')),
        h('div', { class: 'small' }, reveal(l.vi, 'meaning')));
      entries.push({ text: l.zh, el });
      return el;
    });
    rhyme = h('section', { class: 'card dialog rhyme' },
      h('div', { class: 'head' }, h('h2', null, 'Cùng đọc bài vè'), playAll(r.audio, entries)),
      lines);
  }

  return h('div', { class: 'stack' },
    h('div', { class: 'toggles' }, h('span', { class: 'lbl' }, 'Chỉ chữ Hán, chạm từ để tra:'), readBtn),
    blocks, rhyme,
    h('p', { class: 'muted small' }, reading
      ? 'Chế độ đọc: pinyin được ẩn. Chạm vào một từ để xem pinyin, nghĩa và luyện viết.'
      : 'Chạm vào câu để nghe, nút 0.6× để nghe chậm. Nút ▶ đọc lần lượt từng câu.'));
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
  const record = (q, ok) => { if (q.key) { const { key, ...rest } = q; mistakes.record(key, rest, lesson.id, ok); } };
  const start = (items) => { box.replaceChildren(); runExercises(box, items, { onDone: done, onAnswer: record }); };
  // Book exercises get a stable key so the mistake notebook can track them.
  const book = lesson.exercises.map((e, i) => ({ ...e, key: `${lesson.id}:${i}`, lesson: lesson.id }));
  const vocabWords = lesson.vocab.map((w) => ({ ...w, lesson: lesson.id }));
  const counts = (t) => lesson.exercises.filter((e) => t.includes(e.type)).length;
  const item = (title, sub, run) => h('button', { class: 'card menu-item', type: 'button', onClick: run },
    h('span', { class: 't' }, h('b', null, title), h('span', null, sub)), icon('chevron'));

  const best = store.get().scores[lesson.id];
  box.append(h('div', { class: 'menu' },
    item('Bài tập tổng hợp', `${lesson.exercises.length} câu · điền từ, dịch câu, nghe hiểu`, () => start(book)),
    item('Luyện từ vựng', 'Chọn nghĩa, chọn chữ Hán, nghe và chọn từ', () => start(vocabDrills(vocabWords, pool, 9))),
    item('Dịch câu', `${counts(['order'])} câu · sắp xếp từ thành câu tiếng Trung`, () => start(book.filter((e) => e.type === 'order'))),
    item('Nghe hiểu', `${counts(['listen'])} câu`, () => start([...book.filter((e) => e.type === 'listen'), ...vocabDrills(vocabWords, pool, 12).filter((d) => d.type === 'hear')])),
    item('Thanh điệu', 'Nghe và chọn thanh, gõ pinyin', () => { location.hash = `#/tones?lesson=${lesson.id}`; })),
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
  const voice = h('select', { 'aria-label': 'Giọng đọc' });
  const fillVoices = () => {
    const list = chineseVoices();
    voice.replaceChildren(h('option', { value: '' }, list.length ? `Tự động (${list[0].name})` : 'Tự động'),
      list.map((v) => h('option', { value: v.voiceURI, selected: s.voice === v.voiceURI ? true : null }, `${v.name}${v.localService ? '' : ' · online'}`)));
  };
  fillVoices();
  if (hasTTS()) speechSynthesis.addEventListener?.('voiceschanged', () => { if (voice.isConnected) fillVoices(); });
  voice.addEventListener('change', () => { store.update((x) => { x.settings.voice = voice.value; }); speak('你好，我叫李文。'); });
  const goal = h('select', { 'aria-label': 'Mục tiêu mỗi ngày' }, [10, 20, 30, 50].map((v) => h('option', { value: v, selected: (s.dailyGoal || 20) === v ? true : null }, `${v} thẻ`)));
  goal.addEventListener('change', () => store.update((x) => { x.settings.dailyGoal = Number(goal.value); }));
  const perDay = h('select', { 'aria-label': 'Số từ mới mỗi ngày' }, [5, 10, 15, 20, 30].map((v) => h('option', { value: v, selected: s.newPerDay === v ? true : null }, v)));
  perDay.addEventListener('change', () => store.update((x) => { x.settings.newPerDay = Number(perDay.value); }));

  const fileIn = h('input', { type: 'file', accept: 'application/json', hidden: true });
  const msg = h('p', { class: 'small muted', role: 'status' });
  fileIn.addEventListener('change', async () => {
    try { store.import(await fileIn.files[0].text()); msg.textContent = 'Đã khôi phục tiến độ.'; syncNow(); } catch { msg.textContent = 'File không hợp lệ.'; }
  });
  const exportBtn = h('button', { class: 'btn', type: 'button' }, 'Sao lưu tiến độ');
  exportBtn.addEventListener('click', () => {
    const a = h('a', { href: URL.createObjectURL(new Blob([store.export()], { type: 'application/json' })), download: `hsk1-tien-do-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
  });
  const resetBtn = h('button', { class: 'btn', type: 'button' }, 'Xoá tiến độ');
  resetBtn.addEventListener('click', () => {
    if (!resetBtn.dataset.armed) { resetBtn.dataset.armed = '1'; resetBtn.textContent = 'Chạm lần nữa để xoá'; return; }
    store.reset(); syncNow(); route();
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
      h('label', { class: 'setting' }, h('span', { class: 't' }, 'Giọng đọc', h('span', null, hasTTS() ? 'Giọng tiếng Trung có trên máy này' : 'Trình duyệt này không có giọng đọc')), voice),
      h('label', { class: 'setting' }, h('span', { class: 't' }, 'Tốc độ giọng đọc', h('span', null, 'Nút 0.6× luôn đọc chậm')), rate),
      h('label', { class: 'setting' }, h('span', { class: 't' }, 'Mục tiêu mỗi ngày', h('span', null, 'Số thẻ ôn, hiện ở trang chính')), goal),
      h('label', { class: 'setting' }, h('span', { class: 't' }, 'Từ mới mỗi ngày', h('span', null, 'Giới hạn thẻ mới trong phần Ôn tập')), perDay)),
    h('div', { class: 'eyebrow' }, 'Đồng bộ điện thoại & máy tính'),
    syncSection(),
    h('div', { class: 'eyebrow' }, 'Dữ liệu'),
    h('p', { class: 'small muted', style: 'margin-top:0' }, 'Tiến độ được lưu trên thiết bị này (và trong gist nếu bật đồng bộ). Bạn cũng có thể sao lưu ra file.'),
    h('div', { class: 'btn-row' }, exportBtn, h('label', { class: 'btn' }, 'Khôi phục', fileIn)),
    h('div', { style: 'margin-top:8px' }, resetBtn),
    msg);
}

function syncSection() {
  const box = h('div', { class: 'card sync' });
  const fmt = (t) => (t ? new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '');
  const render = () => {
    const info = syncInfo();
    const status = h('p', { class: `small ${info.error ? 'bad' : 'muted'}`, role: 'status' },
      info.status || '', info.last && !info.error ? ` · lần cuối ${fmt(info.last)}` : '');
    if (info.on) {
      box.replaceChildren(
        h('p', { style: 'margin-top:0' }, 'Đang bật. Tiến độ tự đồng bộ khi bạn học, khi mở app và khi rời app.'),
        status,
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn-primary', type: 'button', onClick: () => syncNow() }, 'Đồng bộ ngay'),
          h('button', { class: 'btn', type: 'button', onClick: () => { disconnect(); render(); } }, 'Tắt trên máy này')));
      return;
    }
    const token = h('input', { class: 'search', type: 'password', placeholder: 'ghp_… hoặc github_pat_…', 'aria-label': 'GitHub token', autocomplete: 'off', spellcheck: 'false' });
    const go = h('button', { class: 'btn btn-primary', type: 'button' }, 'Bật đồng bộ');
    go.addEventListener('click', async () => {
      if (!token.value.trim()) { token.focus(); return; }
      go.disabled = true;
      go.textContent = 'Đang kết nối…';
      await connect(token.value);
      render();
    });
    box.replaceChildren(
      h('p', { style: 'margin-top:0' }, 'Lưu tiến độ vào một gist riêng tư trên GitHub để học tiếp trên máy khác.'),
      h('ol', { class: 'small steps' },
        h('li', null, 'Mở ', h('a', { href: 'https://github.com/settings/tokens/new?scopes=gist&description=HSK%201%20sync', target: '_blank', rel: 'noopener' }, 'tạo token trên GitHub'), ', chỉ chọn quyền “gist”.'),
        h('li', null, 'Dán token vào đây và bấm Bật đồng bộ.'),
        h('li', null, 'Làm lại bước 2 trên máy còn lại với cùng token.')),
      token, status,
      h('div', { class: 'btn-row', style: 'margin-top:8px' }, go),
      h('p', { class: 'small muted', style: 'margin-bottom:0' }, 'Token chỉ được lưu trên máy này, không được gửi đi đâu ngoài GitHub.'));
  };
  const off = onSyncStatus(() => { if (!box.isConnected) { off(); return; } if (!box.querySelector('input:focus')) render(); });
  render();
  return box;
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
  closeSheet();
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
    else if (parts[0] === 'words') node = await wordsView(params);
    else if (parts[0] === 'tones') node = await tonesView(params);
    else if (parts[0] === 'mistakes') node = await mistakesView();
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
initSync();
// Synced progress from another device: refresh the home screen numbers.
onSyncStatus((info) => {
  if (info.pulled && (location.hash === '' || location.hash === '#/')) route();
  else if (info.pulled) updateBadge();
});

// Offline support / "Add to Home Screen" on iPhone.
// When a new version is published, the new service worker takes over and the
// page reloads once so the update shows without closing the app.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      // An installed iPhone app is often resumed rather than reopened, so check for updates then too.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (e) {
      console.warn('SW', e);
    }
  });
}
