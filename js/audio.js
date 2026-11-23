// Audio: the device's Chinese text-to-speech voice. The book's own recordings
// (audio/<track>.mp3) are still played if they are ever added.
import { store } from './store.js';

const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
let voices = [];
let current = null;
let runId = 0;

// Voices that sound natural, best first (names differ by platform).
const PREFERRED = [/xiaoxiao/i, /natural/i, /premium/i, /enhanced/i, /tingting|ting-ting/i, /google.*(普通话|mandarin|chinese)/i, /yaoyao|huihui/i, /lili|yu-shu/i];

function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices().filter((v) => /^(zh|cmn)/i.test(v.lang) && !/HK|yue/i.test(v.lang));
}
if (synth) { loadVoices(); synth.addEventListener?.('voiceschanged', loadVoices); }

export const hasTTS = () => !!synth;

/** Chinese voices on this device, best guess first, for the Settings picker. */
export function chineseVoices() {
  loadVoices();
  const score = (v) => {
    const i = PREFERRED.findIndex((re) => re.test(v.name));
    return (i === -1 ? 50 : i) + (/zh[-_]CN/i.test(v.lang) ? 0 : 10);
  };
  return voices.slice().sort((a, b) => score(a) - score(b));
}

function pickVoice() {
  const list = chineseVoices();
  const chosen = store.settings().voice;
  return list.find((v) => v.voiceURI === chosen) || list[0] || null;
}

export function stop() {
  runId++;
  if (current) { current.pause(); current = null; }
  synth?.cancel();
  document.querySelectorAll('.speaking').forEach((el) => el.classList.remove('speaking'));
}

function say(text, rate) {
  if (!synth) return Promise.resolve(false);
  return new Promise((resolve) => {
    // Spell "AI" as letters so the Chinese voice does not skip it.
    const u = new SpeechSynthesisUtterance(text.replace(/AI/g, 'A I'));
    u.lang = 'zh-CN';
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = rate ?? store.settings().rate;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    synth.speak(u);
  });
}

export function speak(text, rate) {
  stop();
  return say(text, rate);
}

/** Read lines one after another, highlighting each element while it is spoken. */
export async function speakLines(lines) {
  stop();
  const id = runId;
  for (const { text, el } of lines) {
    if (id !== runId) return false;
    el?.classList.add('speaking');
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    await say(text);
    el?.classList.remove('speaking');
    if (id !== runId) return false;
    await new Promise((r) => setTimeout(r, 350));
  }
  return true;
}

/** Play a book track (e.g. "1-3") if the file exists; otherwise run the fallback (read the lines aloud). */
export function playTrack(id, fallback) {
  stop();
  return new Promise((resolve) => {
    let fell = false;
    const fb = () => {
      if (fell) return;
      fell = true;
      current = null;
      Promise.resolve(fallback()).then(resolve);
    };
    if (!id) return fb();
    const a = new Audio(`audio/${id}.mp3`);
    current = a;
    a.onended = () => { current = null; resolve(true); };
    a.onerror = fb;
    a.play().catch(fb);
  });
}

/** Wire a button so it shows a "playing" state while audio runs. */
export function bindPlay(btn, run) {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    document.querySelectorAll('.playing').forEach((el) => el.classList.remove('playing'));
    btn.classList.add('playing');
    await run();
    btn.classList.remove('playing');
  });
  return btn;
}
