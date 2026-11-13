// Audio: plays the book's recording (audio/<id>.mp3) when present,
// otherwise falls back to the browser's Chinese text-to-speech voice.
import { store } from './store.js';

const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
let voice = null;
let current = null;

function pickVoice() {
  if (!synth) return;
  const vs = synth.getVoices();
  voice = vs.find((v) => /zh[-_]CN/i.test(v.lang)) || vs.find((v) => /^zh/i.test(v.lang)) || null;
}
if (synth) { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); }

export const hasTTS = () => !!synth;

export function stop() {
  if (current) { current.pause(); current = null; }
  synth?.cancel();
}

export function speak(text, rate) {
  stop();
  if (!synth) return Promise.resolve(false);
  return new Promise((resolve) => {
    // Spell "AI" as letters so the Chinese voice does not skip it.
    const u = new SpeechSynthesisUtterance(text.replace(/AI/g, 'A I'));
    u.lang = 'zh-CN';
    if (voice) u.voice = voice;
    u.rate = rate ?? store.settings().rate;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    synth.speak(u);
  });
}

/** Play a book track (e.g. "1-3"); if the file is missing, read fallbackText aloud. */
export function playTrack(id, fallbackText) {
  stop();
  return new Promise((resolve) => {
    let fell = false;
    const fallback = () => {
      if (fell) return;
      fell = true;
      current = null;
      speak(fallbackText).then(resolve);
    };
    if (!id) return fallback();
    const a = new Audio(`audio/${id}.mp3`);
    current = a;
    a.onended = () => { current = null; resolve(true); };
    a.onerror = fallback;
    a.play().catch(fallback);
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
