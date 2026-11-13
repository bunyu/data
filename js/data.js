// Loads course content from /data. See docs/CONTENT_FORMAT.md.
let course;
const lessons = new Map();

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được ${url} (${res.status})`);
  return res.json();
}

export async function getCourse() {
  course ??= await getJSON('data/course.json');
  return course;
}

export async function getLesson(id) {
  id = Number(id);
  if (lessons.has(id)) return lessons.get(id);
  const c = await getCourse();
  const meta = c.lessons.find((l) => l.id === id);
  if (!meta) return null;
  const lesson = meta.file ? { ...meta, ...(await getJSON(`data/${meta.file}`)), ready: true } : { ...meta, ready: false };
  lessons.set(id, lesson);
  return lesson;
}

export async function getReadyLessons() {
  const c = await getCourse();
  return Promise.all(c.lessons.filter((l) => l.file).map((l) => getLesson(l.id)));
}

/** All vocabulary from ready lessons, each word tagged with its lesson id. */
export async function getAllVocab() {
  const ls = await getReadyLessons();
  return ls.flatMap((l) => l.vocab.map((w) => ({ ...w, lesson: l.id })));
}
