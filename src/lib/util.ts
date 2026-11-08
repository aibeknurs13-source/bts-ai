export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export const todayStr = (d = new Date()) => d.toLocaleDateString('en-CA');

export const shuffle = <T,>(arr: T[]): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const hash = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

/** Lowercase, strip markdown/punctuation, collapse spaces — used for duplicate detection. */
export const norm = (s: string): string =>
  String(s || '')
    .toLowerCase()
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`~$<>|\\{}()[\]#]/g, ' ')
    .replace(/[^a-zа-яёәіөұүһқңғөҗә\/0-9\s.-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const tokens = (s: string): string[] =>
  norm(s)
    .split(' ')
    .filter((w) => (w.length > 2 || /\d/.test(w)) && w.length > 0);

/** Jaccard similarity of word sets — 0..1. */
export const similarity = (a: string, b: string): number => {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((w) => {
    if (B.has(w)) inter++;
  });
  return inter / (A.size + B.size - inter);
};

export const formatBytes = (n: number): string => {
  if (!n) return '0 Б';
  const u = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
};

export const fmtDate = (t: number): string =>
  new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const levelMeta: Record<string, { name: string; short: string; color: string; desc: string }> = {
  A: { name: 'Уровень A', short: 'A', color: 'var(--lA)', desc: 'База: термины, факты, формулы' },
  B: { name: 'Уровень B', short: 'B', color: 'var(--lB)', desc: 'Средний: применение, расчёты' },
  C: { name: 'Уровень C', short: 'C', color: 'var(--lC)', desc: 'Сложный: многошаговые задачи' },
};

export const LEVELS = ['A', 'B', 'C'] as const;

export const clampText = (s: string, n: number): string => (s.length > n ? s.slice(0, n) + '…' : s);

export const safeJson = <T,>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
