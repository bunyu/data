// Pinyin helpers: split a word's pinyin into syllables, read its tones,
// and compare typed answers ("ni3hao3", "nǐ hǎo", "lv4") with the book's pinyin.

const MARKS = {
  ā: ['a', 1], á: ['a', 2], ǎ: ['a', 3], à: ['a', 4],
  ē: ['e', 1], é: ['e', 2], ě: ['e', 3], è: ['e', 4],
  ī: ['i', 1], í: ['i', 2], ǐ: ['i', 3], ì: ['i', 4],
  ō: ['o', 1], ó: ['o', 2], ǒ: ['o', 3], ò: ['o', 4],
  ū: ['u', 1], ú: ['u', 2], ǔ: ['u', 3], ù: ['u', 4],
  ǖ: ['ü', 1], ǘ: ['ü', 2], ǚ: ['ü', 3], ǜ: ['ü', 4],
};
const MARKED = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' };

// One syllable: optional initial, a final not followed by another vowel, optional erhua r.
const SYL = /^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(iang|iong|uang|ueng|ang|eng|ing|ong|uan|ian|uai|iao|üan|ai|ei|ao|ou|an|en|in|un|ün|ia|ie|iu|ua|uo|ui|üe|ue|er|a|o|e|i|u|ü|n|ng|m)(r(?![aeiouü]))?(?![aeiouü])/;

/** Split pinyin into syllables: [{ base: 'hao', tone: 3 }]. Tone 0 = neutral. Null if it can't be parsed. */
export function syllables(pinyin) {
  // Only the first reading of variants like "shéi/shuí".
  const src = pinyin.split('/')[0].toLowerCase().normalize('NFC');
  const base = [];
  const tones = [];
  for (const ch of src) {
    if (/[\s'’\-·]/.test(ch)) { base.push(' '); tones.push(0); continue; }
    if (/[,.!?，。！？]/.test(ch)) continue;
    const m = MARKS[ch];
    base.push(m ? m[0] : ch === 'v' ? 'ü' : ch);
    tones.push(m ? m[1] : 0);
  }
  const out = [];
  let i = 0;
  while (i < base.length) {
    if (base[i] === ' ') { i++; continue; }
    const rest = base.slice(i).join('');
    const end = rest.indexOf(' ');
    const chunk = end === -1 ? rest : rest.slice(0, end);
    const m = chunk.match(SYL);
    if (!m) return null;
    const len = m[0].length;
    const tone = tones.slice(i, i + len).find((t) => t) || 0;
    out.push({ base: m[0], tone });
    i += len;
  }
  return out;
}

/** Tones of a word, one per character, or null when the pinyin doesn't line up with the characters. */
export function tonesOf(word) {
  const s = syllables(word.pinyin);
  let chars = (word.hanzi.match(/[一-鿿]/g) || []).length;
  // Erhua: 一点儿 yìdiǎnr has three characters but two syllables.
  if (word.hanzi.endsWith('儿') && s?.at(-1)?.base.endsWith('r') && s.at(-1).base !== 'er') chars--;
  if (!s || s.length !== chars || chars === 0) return null;
  return s.map((x) => x.tone);
}

/** "nǐ hǎo" → "ni3hao3"; neutral tones get no number; erhua as "dian3r". */
export function toNumbered(pinyin, erhuaAfter = false) {
  if (/\d/.test(pinyin)) {
    return pinyin.toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü').replace(/[05]/g, '').replace(/[^a-zü1-4]/g, '');
  }
  const s = syllables(pinyin);
  if (!s) return pinyin.toLowerCase().replace(/[^a-zü]/g, '');
  return s.map((x) => {
    const t = x.tone || '';
    if (!erhuaAfter && x.base.length > 2 && x.base.endsWith('r') && x.base !== 'er') return x.base.slice(0, -1) + t + 'r';
    return x.base + t;
  }).join('');
}

/** Does a typed answer match the book's pinyin? Accepts numbers or tone marks, any spacing. */
export function samePinyin(typed, target) {
  if (!typed.trim()) return false;
  const t = toNumbered(typed);
  return t === toNumbered(target) || t === toNumbered(target, true);
}

/** Put the tone mark on the right vowel: ("hao", 3) → "hǎo". */
export function markSyllable(base, tone) {
  if (!tone) return base;
  let idx = base.search(/[ae]/);
  if (idx === -1) idx = base.indexOf('ou');
  if (idx === -1) {
    // Last vowel (covers iu → iù, ui → uì).
    for (let i = base.length - 1; i >= 0; i--) if ('iouü'.includes(base[i])) { idx = i; break; }
  }
  if (idx === -1) return base;
  return base.slice(0, idx) + MARKED[base[idx]][tone - 1] + base.slice(idx + 1);
}

/** "ni3hao3" → "nǐhǎo" (for showing what the learner typed). */
export function numberedToMarks(input) {
  return input.toLowerCase().replace(/u:|v/g, 'ü').replace(/([a-zü]+)([0-5])/g, (_, b, t) => markSyllable(b, Number(t) % 5));
}

export const TONE_NAME = ['nhẹ', '1', '2', '3', '4'];
export const tonePattern = (tones) => tones.map((t) => TONE_NAME[t]).join(' · ');

/** Remove accents for search: "Táo" → "tao", "đồng" → "dong", "nǚ" → "nu". */
export function fold(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/ü/g, 'u');
}
