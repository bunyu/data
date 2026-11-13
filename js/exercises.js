// Exercise runner: multiple choice, fill-in-the-blank, sentence ordering
// (translation), and listening. One question per screen, answers in the thumb zone.
import { h, icon, shuffle, reveal } from './ui.js';
import { speak, bindPlay } from './audio.js';

const KIND = {
  choice: 'Chọn đáp án',
  fill: 'Điền vào chỗ trống',
  order: 'Dịch câu: sắp xếp từ',
  listen: 'Nghe hiểu',
  meaning: 'Chọn nghĩa',
  hanzi: 'Chọn chữ Hán',
  hear: 'Nghe và chọn từ',
};

const PUNCT = /[，。！？、,.!?\s]/g;
const isPunct = (t) => t.replace(PUNCT, '') === '';

/** Build vocabulary drills from a lesson's words, with distractors from `pool`. */
export function vocabDrills(words, pool, n = 8) {
  const usable = words.filter((w) => !w.proper);
  const others = pool.filter((w) => !w.proper);
  const pick = (w, key) => shuffle([w[key], ...shuffle(others.filter((o) => o[key] !== w[key]).map((o) => o[key]))
    .filter((v, i, a) => a.indexOf(v) === i).slice(0, 3)]);
  const kinds = ['meaning', 'hanzi', 'hear'];
  return shuffle(usable).slice(0, n).map((w, i) => {
    const type = kinds[i % kinds.length];
    if (type === 'meaning') {
      const options = pick(w, 'vi');
      return { type, word: w, options, answer: options.indexOf(w.vi) };
    }
    const options = pick(w, 'hanzi');
    return { type, word: w, options, answer: options.indexOf(w.hanzi) };
  });
}

export function runExercises(container, items, { onDone } = {}) {
  let i = 0;
  let correct = 0;

  const bar = h('i', { style: 'width:0%' });
  const body = h('div', { class: 'ex-wrap' });
  container.replaceChildren(h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': items.length }, bar), body);

  const next = () => {
    i++;
    bar.style.width = `${(i / items.length) * 100}%`;
    if (i >= items.length) finish(); else show();
  };

  function feedback(ok, detail) {
    if (ok) correct++;
    const btn = h('button', { class: 'btn btn-primary btn-block', type: 'button', onClick: next }, i + 1 >= items.length ? 'Xem kết quả' : 'Tiếp tục');
    const fb = h('div', { class: `feedback ${ok ? 'ok' : 'bad'}`, role: 'status' },
      h('div', { class: 'verdict' }, ok ? 'Chính xác' : 'Chưa đúng'),
      detail,
      btn);
    body.append(fb);
    btn.focus({ preventScroll: true });
    fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function optionButtons(q, { zh = false, onPick }) {
    const wrap = h('div', { class: `options ${zh && q.options.length === 4 ? 'two' : ''}` });
    q.options.forEach((opt, idx) => {
      const b = h('button', { class: `opt ${zh ? 'zh' : ''}`, type: 'button' }, opt);
      b.addEventListener('click', () => {
        const ok = idx === q.answer;
        wrap.querySelectorAll('button').forEach((x, j) => {
          x.disabled = true;
          if (j === q.answer) x.classList.add('correct');
        });
        if (!ok) b.classList.add('wrong');
        onPick(ok, idx);
      });
      wrap.append(b);
    });
    return wrap;
  }

  const playButton = (text) => bindPlay(h('button', { class: 'listen-btn', type: 'button', 'aria-label': 'Nghe lại' }, icon('speaker')), () => speak(text));

  function show() {
    const q = items[i];
    body.replaceChildren(h('div', { class: 'q-kind' }, `${KIND[q.type] || ''} · ${i + 1}/${items.length}`));

    if (q.type === 'choice') {
      body.append(h('div', { class: 'q-prompt' }, q.prompt));
      body.append(optionButtons(q, { zh: q.options.every((o) => /[一-鿿]/.test(o) && o.length < 12), onPick: (ok) => feedback(ok, q.explain ? h('div', { class: 'small' }, q.explain) : null) }));
    }

    if (q.type === 'fill') {
      const [a, b] = q.sentence.split('___');
      const blank = h('span', { class: 'blank' }, ' ');
      body.append(h('div', { class: 'q-sentence zh' }, a, blank, b ?? ''));
      body.append(h('div', { class: 'q-hint' }, reveal(q.vi, 'meaning')));
      body.append(optionButtons(q, {
        zh: true,
        onPick: (ok, idx) => {
          blank.textContent = q.options[ok ? idx : q.answer];
          const full = q.sentence.replace('___', q.options[q.answer]);
          feedback(ok, h('div', null, h('div', { class: 'zh' }, full), h('div', { class: 'small muted' }, q.vi)));
        },
      }));
    }

    if (q.type === 'listen') {
      body.append(h('div', { class: 'q-prompt' }, q.prompt));
      const pb = playButton(q.say);
      body.append(pb);
      body.append(optionButtons(q, {
        onPick: (ok) => feedback(ok, h('div', { class: 'zh' }, q.say)),
      }));
      setTimeout(() => pb.click(), 250);
    }

    if (q.type === 'meaning') {
      body.append(h('div', { class: 'q-big' }, q.word.hanzi));
      body.append(optionButtons(q, { onPick: (ok) => feedback(ok, wordDetail(q.word)) }));
    }

    if (q.type === 'hanzi') {
      body.append(h('div', { class: 'q-prompt' }, `“${q.word.vi}”`));
      body.append(optionButtons(q, { zh: true, onPick: (ok) => feedback(ok, wordDetail(q.word)) }));
    }

    if (q.type === 'hear') {
      body.append(h('div', { class: 'q-prompt' }, 'Bạn nghe thấy từ nào?'));
      const pb = playButton(q.word.hanzi);
      body.append(pb);
      body.append(optionButtons(q, { zh: true, onPick: (ok) => feedback(ok, wordDetail(q.word)) }));
      setTimeout(() => pb.click(), 250);
    }

    if (q.type === 'order') renderOrder(q);
  }

  function wordDetail(w) {
    return h('div', null,
      h('span', { class: 'zh' }, w.hanzi), ' ',
      h('span', { class: 'muted' }, w.pinyin), ' — ', w.vi);
  }

  function renderOrder(q) {
    body.append(h('div', { class: 'q-prompt' }, `“${q.vi}”`));
    const line = h('div', { class: 'answer-line', 'aria-label': 'Câu trả lời của bạn' });
    const pool = h('div', { class: 'tiles' });
    const words = shuffle(q.tiles.filter((t) => !isPunct(t)));
    const picked = [];
    const check = h('button', { class: 'btn btn-primary btn-block', type: 'button', disabled: true }, 'Kiểm tra');

    words.forEach((t) => {
      const src = h('button', { class: 'tile', type: 'button' }, t);
      src.addEventListener('click', () => {
        src.classList.add('used');
        const placed = h('button', { class: 'tile', type: 'button' }, t);
        placed.addEventListener('click', () => {
          if (check.dataset.done) return;
          placed.remove();
          picked.splice(picked.indexOf(placed), 1);
          src.classList.remove('used');
          check.disabled = picked.length === 0;
        });
        picked.push(placed);
        line.append(placed);
        check.disabled = false;
      });
      pool.append(src);
    });

    check.addEventListener('click', () => {
      check.dataset.done = '1';
      check.remove();
      pool.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      const given = picked.map((p) => p.textContent).join('').replace(PUNCT, '');
      const accepted = [q.answer, ...(q.accept || [])].map((s) => s.replace(PUNCT, ''));
      const ok = accepted.includes(given);
      line.style.borderColor = ok ? 'var(--ok)' : 'var(--bad)';
      feedback(ok, h('div', null, h('div', { class: 'zh' }, q.answer), q.pinyin ? h('div', { class: 'small muted' }, q.pinyin) : null));
    });

    body.append(line, pool, h('div', { style: 'margin-top:auto;padding-top:16px' }, check));
  }

  function finish() {
    const pct = Math.round((correct / items.length) * 100);
    onDone?.(pct);
    body.replaceChildren(h('div', { class: 'result' },
      h('div', { class: 'score' }, `${correct}/${items.length}`),
      h('p', { class: 'muted' }, pct >= 80 ? 'Rất tốt. Bạn đã nắm vững phần này.' : pct >= 50 ? 'Khá ổn. Ôn lại những câu sai rồi thử lần nữa.' : 'Hãy xem lại từ vựng và bài khoá, sau đó làm lại.'),
      h('div', { class: 'btn-row', style: 'margin-top:24px' },
        h('button', { class: 'btn', type: 'button', onClick: () => runExercises(container, shuffle(items), { onDone }) }, 'Làm lại'),
        h('a', { class: 'btn btn-primary', href: '#/' }, 'Về danh sách bài'))));
  }

  show();
}
