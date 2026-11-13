// Flashcards with spaced repetition (local, per device).
import { h, icon, reveal } from './ui.js';
import { store, srs } from './store.js';
import { getAllVocab, getLesson } from './data.js';
import { speak, bindPlay } from './audio.js';

function buildQueue(vocab, lessonId) {
  if (lessonId) return vocab.filter((w) => w.lesson === lessonId);
  const now = Date.now();
  const due = vocab.filter((w) => srs.isDue(w.id, now)).sort((a, b) => srs.card(a.id).due - srs.card(b.id).due);
  const fresh = vocab.filter((w) => !srs.card(w.id)).slice(0, srs.newLeftToday());
  return [...due, ...fresh];
}

function masked(text, label, cls = '') {
  const el = h('span', { class: `reveal is-hidden ${cls}`, 'data-kind': 'answer', 'data-label': label, role: 'button', tabindex: '0', 'aria-label': label }, text);
  el.addEventListener('click', () => el.classList.remove('is-hidden'));
  return el;
}

export async function reviewView(params) {
  const lessonId = params.get('lesson') ? Number(params.get('lesson')) : null;
  const vocab = await getAllVocab();
  const queue = buildQueue(vocab, lessonId);
  const lesson = lessonId ? await getLesson(lessonId) : null;
  const total = queue.length;
  let reviewed = 0;

  const root = h('div');
  const top = h('div', { class: 'flash-top' });
  const stage = h('div', { class: 'flash' });

  const front = () => store.settings().cardFront;
  const flip = h('button', { class: 'chip', type: 'button' });
  const setFlipLabel = () => { flip.textContent = front() === 'hanzi' ? 'Hán → Việt' : 'Việt → Hán'; };
  setFlipLabel();
  flip.addEventListener('click', () => {
    store.update((s) => { s.settings.cardFront = front() === 'hanzi' ? 'vi' : 'hanzi'; });
    setFlipLabel();
    show();
  });

  root.append(
    h('div', { class: 'page-head' },
      lesson && h('a', { class: 'back', href: `#/lesson/${lesson.id}`, 'aria-label': 'Quay lại bài học' }, icon('back')),
      h('h1', null, lesson ? `Thẻ từ · Bài ${lesson.id}` : 'Ôn tập hôm nay'),
      h('span', { style: 'margin-left:auto' }, flip)),
    top, stage);

  function show() {
    const w = queue[0];
    if (!w) {
      top.replaceChildren();
      stage.replaceChildren(h('div', { class: 'empty' },
        h('p', { style: 'font-size:18px;color:var(--ink)' }, reviewed ? `Xong! Bạn đã ôn ${reviewed} thẻ.` : 'Không có thẻ nào cần ôn lúc này.'),
        h('p', null, lessonId ? 'Bạn có thể làm bài luyện tập của bài này.' : 'Hãy quay lại sau, hoặc học thẻ theo từng bài.'),
        h('a', { class: 'btn btn-primary', href: lessonId ? `#/lesson/${lessonId}/practice` : '#/', style: 'margin-top:8px' }, lessonId ? 'Luyện tập' : 'Về bài học')));
      return;
    }
    const state = srs.card(w.id);
    top.replaceChildren(
      h('span', null, `Còn ${queue.length} thẻ`),
      h('span', null, !state ? 'Từ mới' : `Bài ${w.lesson}`));

    const sayBtn = bindPlay(h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Nghe' }, icon('speaker')), () => speak(w.hanzi));
    const grades = h('div', { class: 'grades', hidden: true },
      gradeBtn('again', 'Quên'), gradeBtn('hard', 'Khó'), gradeBtn('good', 'Nhớ', 'btn-primary'));
    const showGrades = () => { grades.hidden = false; showBtn.hidden = true; };

    let card;
    if (front() === 'hanzi') {
      const py = reveal(w.pinyin, 'pinyin', 'py');
      const vi = reveal(w.vi, 'meaning', 'vi');
      [py, vi].forEach((r) => r.addEventListener('click', showGrades));
      card = h('div', { class: 'flash-card' }, h('div', { class: 'hz' }, w.hanzi), sayBtn, py, vi);
    } else {
      const hz = masked(w.hanzi, 'Hiện chữ Hán', 'hz');
      const py = reveal(w.pinyin, 'pinyin', 'py');
      hz.addEventListener('click', () => { showGrades(); speak(w.hanzi); });
      card = h('div', { class: 'flash-card' }, h('div', { class: 'front-vi' }, w.vi), hz, py);
    }
    const showBtn = h('button', { class: 'btn btn-block', type: 'button', style: 'margin-top:12px' }, 'Hiện đáp án');
    showBtn.addEventListener('click', () => {
      card.querySelectorAll('.reveal').forEach((r) => r.classList.remove('is-hidden'));
      if (front() === 'vi') speak(w.hanzi);
      showGrades();
    });

    function gradeBtn(g, label, cls = '') {
      return h('button', { class: `btn ${cls}`, type: 'button', onClick: () => {
        srs.grade(w.id, g);
        reviewed++;
        queue.shift();
        if (g === 'again') queue.push(w);   // see it again this session
        show();
      } }, label, h('small', null, srs.preview(w.id, g)));
    }

    stage.replaceChildren(card, showBtn, grades);
  }

  show();
  if (total === 0 && !lessonId) { /* empty state rendered by show() */ }
  return root;
}
