// Tone & pinyin trainer and the mistake notebook.
import { h, icon, backLink } from './ui.js';
import { mistakes } from './store.js';
import { getAllVocab, getCourse } from './data.js';
import { runExercises, toneDrills } from './exercises.js';

const record = (q, ok) => { if (q.key) mistakes.record(q.key, strip(q), q.lesson ?? q.word?.lesson ?? null, ok); };
// Keep only what is needed to ask the question again.
function strip(q) {
  const { key, ...rest } = q;
  return rest;
}

const menuItem = (title, sub, run) => h('button', { class: 'card menu-item', type: 'button', onClick: run },
  h('span', { class: 't' }, h('b', null, title), h('span', null, sub)), icon('chevron'));

/* ------------------------------------------------------------------ Tones */
export async function tonesView(params) {
  const vocab = await getAllVocab();
  const course = await getCourse();
  const ready = [...new Set(vocab.map((w) => w.lesson))];
  const box = h('div');
  const pick = h('select', { 'aria-label': 'Chọn bài' },
    h('option', { value: '' }, 'Tất cả các bài'),
    ready.map((id) => h('option', { value: id, selected: String(id) === params.get('lesson') ? true : null }, `Bài ${id} · ${course.lessons.find((l) => l.id === id)?.vi || ''}`)));
  const words = () => (pick.value ? vocab.filter((w) => w.lesson === Number(pick.value)) : vocab);
  const start = (kind) => { box.replaceChildren(); runExercises(box, toneDrills(words(), 10, kind), { onAnswer: record }); };

  box.append(
    h('label', { class: 'setting card', style: 'margin-bottom:12px' }, h('span', { class: 't' }, 'Từ của', h('span', null, 'Chọn bài để luyện')), pick),
    h('div', { class: 'menu' },
      menuItem('Nghe và chọn thanh điệu', '10 từ · nghe rồi chọn dãy thanh, vd. 3 · 3', () => start('tone')),
      menuItem('Gõ pinyin', '10 từ · nhìn chữ Hán, gõ pinyin kèm số thanh', () => start('typepy'))),
    h('div', { class: 'card tone-help' },
      h('div', { class: 'eyebrow', style: 'margin-top:0' }, 'Bốn thanh và thanh nhẹ'),
      h('ul', null,
        h('li', null, h('b', null, '1 · ā'), ' cao và đều'),
        h('li', null, h('b', null, '2 · á'), ' đi lên, như thanh sắc'),
        h('li', null, h('b', null, '3 · ǎ'), ' xuống thấp rồi lên, như thanh hỏi'),
        h('li', null, h('b', null, '4 · à'), ' rơi mạnh từ cao xuống'),
        h('li', null, h('b', null, 'nhẹ · a'), ' ngắn và nhẹ, không có số')),
      h('p', { class: 'small muted', style: 'margin-bottom:0' }, 'Đáp án theo thanh điệu ghi trong sách (chưa tính biến điệu như 你好 đọc thành 2 · 3).')));

  return h('div', null,
    h('div', { class: 'page-head' }, backLink('#/'), h('h1', null, 'Thanh điệu & pinyin')),
    box);
}

/* -------------------------------------------------------------- Mistakes */
export async function mistakesView() {
  const course = await getCourse();
  const box = h('div');

  function list() {
    const open = mistakes.open().sort((a, b) => b.at - a.at);
    if (!open.length) {
      box.replaceChildren(h('div', { class: 'empty' },
        h('p', { style: 'font-size:18px;color:var(--ink)' }, 'Sổ lỗi đang trống.'),
        h('p', null, 'Câu nào bạn làm sai sẽ được ghi ở đây, và tự xoá khi bạn làm đúng 2 lần liên tiếp.'),
        h('a', { class: 'btn btn-primary', href: '#/', style: 'margin-top:8px' }, 'Về bài học')));
      return;
    }
    const byLesson = new Map();
    for (const m of open) byLesson.set(m.lesson, (byLesson.get(m.lesson) || 0) + 1);
    const drill = open.slice(0, 20).map((m) => ({ ...m.q, key: m.key, lesson: m.lesson }));
    box.replaceChildren(
      h('button', { class: 'btn btn-primary btn-block', type: 'button', onClick: () => {
        box.replaceChildren();
        runExercises(box, drill, { onAnswer: record, onDone: () => {} });
      } }, `Làm lại ${drill.length} câu sai`),
      h('p', { class: 'small muted' }, `${open.length} câu đang chờ. Mỗi câu được xoá khỏi sổ khi bạn làm đúng 2 lần liên tiếp.`),
      h('div', { class: 'eyebrow' }, 'Theo bài'),
      h('ul', { class: 'list-card' }, [...byLesson].sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99)).map(([id, n]) => h('li', { class: 'setting' },
        h('span', { class: 't' }, id ? `Bài ${id}` : 'Khác', h('span', null, course.lessons.find((l) => l.id === id)?.vi || '')),
        h('b', null, n)))),
      h('div', { class: 'eyebrow' }, 'Gần đây'),
      h('ul', { class: 'list-card mk-list' }, open.slice(0, 30).map((m) => h('li', null, describe(m.q), h('span', { class: 'muted small' }, `sai ${m.wrong} lần`)))));
  }
  list();

  return h('div', null,
    h('div', { class: 'page-head' }, backLink('#/'), h('h1', null, 'Sổ lỗi')),
    box);
}

function describe(q) {
  if (q.word) return h('span', null, h('span', { class: 'zh' }, q.word.hanzi), ' ', h('span', { class: 'muted' }, q.word.vi));
  const text = q.sentence || q.prompt || q.vi || q.say || '';
  return h('span', { class: /[一-鿿]/.test(text) ? 'zh' : '' }, text.length > 40 ? `${text.slice(0, 40)}…` : text);
}
