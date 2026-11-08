import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AIConfig, AppData, BankItem, Card, Deck, Level, Material, Mistake, MiniState, Note, Profile, Subject, TestRun } from './lib/types';
import { kvGetAny, kvSet, stateKey } from './lib/db';
import { hash, norm, todayStr, uid } from './lib/util';

export interface User {
  em: string;
  name: string;
  pic: string;
}

export interface Settings {
  ai: AIConfig;
  googleClientId: string;
  theme: 'dark' | 'light';
  calOpen: boolean;
}

export const DEFAULT_GOOGLE_ID = '549332087816-cjqvi6bjkoumsuqdj852vn7c14bma3io.apps.googleusercontent.com';

export const DEFAULT_AI: AIConfig = {
  provider: 'gemini',
  key: '',
  geminiModel: 'gemini-3.8-flash',
  openaiModel: 'google/gemma-3-27b-it:free',
  openaiBase: '',
  temperature: 0.7,
};

export const DEFAULT_SETTINGS: Settings = {
  ai: DEFAULT_AI,
  googleClientId: DEFAULT_GOOGLE_ID,
  theme: 'dark',
  calOpen: false,
};

export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'algebra', name: 'Algebra', ru: 'Алгебра', emoji: '∑', color: '#6366f1' },
  { id: 'biology', name: 'Biology', ru: 'Биология', emoji: '🧬', color: '#22c55e' },
  { id: 'qazaq', name: 'Қазақ тілі', ru: 'Казахский язык', emoji: '📖', color: '#f59e0b' },
  { id: 'chemistry', name: 'Chemistry', ru: 'Химия', emoji: '⚗️', color: '#a855f7' },
  { id: 'physics', name: 'Physics', ru: 'Физика', emoji: '⚛️', color: '#06b6d4' },
  { id: 'history', name: 'Қазақстан тарихы', ru: 'История Казахстана', emoji: '🏛️', color: '#ef4444' },
];

const emptyData = (): AppData => ({
  subjects: DEFAULT_SUBJECTS,
  materials: [],
  tests: [],
  decks: [],
  notes: [],
  bank: [],
  mistakes: [],
  mini: {},
  profile: { points: 0, streak: 0, best: 0, last: '', totalTests: 0, totalQuestions: 0 },
});

export interface MasteryInfo {
  byLevel: Record<Level, { right: number; wrong: number }>;
  byTopic: { topic: string; level: Level; right: number; wrong: number }[];
  weakTopics: string[];
  acc: Record<Level, number>;
}

export function computeMastery(data: AppData): MasteryInfo {
  const byLevel: Record<Level, { right: number; wrong: number }> = {
    A: { right: 0, wrong: 0 },
    B: { right: 0, wrong: 0 },
    C: { right: 0, wrong: 0 },
  };
  const topicMap = new Map<string, { topic: string; level: Level; right: number; wrong: number }>();
  const bump = (q: any, ok: boolean) => {
    const lvl = (['A', 'B', 'C'].includes(q?.level) ? q.level : 'A') as Level;
    byLevel[lvl][ok ? 'right' : 'wrong']++;
    const t = String(q?.topic || 'Общая тема').slice(0, 60);
    const key = `${t}|${lvl}`;
    const e = topicMap.get(key) || { topic: t, level: lvl, right: 0, wrong: 0 };
    if (ok) e.right++;
    else e.wrong++;
    topicMap.set(key, e);
  };
  data.tests.forEach((t) => {
    if (!t.finishedAt) return;
    t.questions.forEach((q, i) => bump(q, t.answers[i] === q.answer));
  });
  data.mistakes.forEach((m) => bump(m.question, false));
  const byTopic = [...topicMap.values()].sort((a, b) => a.wrong / (a.wrong + a.right + 1) - b.wrong / (b.wrong + b.right + 1));
  const weakTopics = byTopic
    .filter((t) => t.wrong >= 1 && t.wrong / (t.wrong + t.right) >= 0.4)
    .slice(0, 4)
    .map((t) => t.topic);
  const acc = {
    A: byLevel.A.right + byLevel.A.wrong ? byLevel.A.right / (byLevel.A.right + byLevel.A.wrong) : 0.5,
    B: byLevel.B.right + byLevel.B.wrong ? byLevel.B.right / (byLevel.B.right + byLevel.B.wrong) : 0.5,
    C: byLevel.C.right + byLevel.C.wrong ? byLevel.C.right / (byLevel.C.right + byLevel.C.wrong) : 0.5,
  } as Record<Level, number>;
  return { byLevel, byTopic, weakTopics, acc };
}

export function adaptiveMix(m: MasteryInfo): Record<Level, number> {
  const { acc } = m;
  if (acc.C >= 0.75) return { A: 0.1, B: 0.25, C: 0.65 };
  if (acc.B >= 0.6) return { A: 0.2, B: 0.45, C: 0.35 };
  return { A: 0.4, B: 0.4, C: 0.2 };
}

export function adaptiveReason(m: MasteryInfo, mix: Record<Level, number>): string {
  const pct = (l: Level) => Math.round(mix[l] * 100);
  const s = m.byLevel.A.right + m.byLevel.A.wrong + m.byLevel.B.right + m.byLevel.B.wrong + m.byLevel.C.right + m.byLevel.C.wrong;
  if (!s) return `Стартовый набор: A ${pct('A')}% · B ${pct('B')}% · C ${pct('C')}%`;
  const accTxt = `A ${Math.round(m.acc.A * 100)}% · B ${Math.round(m.acc.B * 100)}% · C ${Math.round(m.acc.C * 100)}%`;
  const weak = m.weakTopics.length ? ` Слабые места: ${m.weakTopics.slice(0, 2).join(', ')}.` : '';
  return `Ваш результат ${accTxt} → набор A ${pct('A')}% · B ${pct('B')}% · C ${pct('C')}%.${weak}`;
}

interface Ctx {
  user: User | null;
  data: AppData;
  settings: Settings;
  ready: boolean;
  mastery: MasteryInfo;
  signIn: (u: User) => Promise<void>;
  signOut: () => void;
  setSettings: (patch: Partial<Settings>) => void;
  setAI: (patch: Partial<AIConfig>) => void;
  setData: (fn: (d: AppData) => AppData) => void;
  addMaterial: (m: Material) => void;
  removeMaterial: (id: string) => void;
  addTest: (t: TestRun) => void;
  updateTest: (id: string, patch: Partial<TestRun>) => void;
  addDeck: (d: Deck) => void;
  updateDeck: (id: string, patch: Partial<Deck>) => void;
  addNote: (n: Note) => void;
  removeNote: (id: string) => void;
  addBank: (items: BankItem[]) => void;
  addMistake: (q: any, subjectId: string) => void;
  updateMistake: (id: string, patch: Partial<Mistake>) => void;
  clearMistake: (id: string) => void;
  updateMini: (id: string, fn: (m: MiniState) => MiniState) => void;
  bump: (points: number) => void;
  addSubject: (s: Subject) => void;
  removeSubject: (id: string) => void;
  exportData: () => string;
  importData: (json: string) => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export const useStore = () => {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('useStore outside provider');
  return c;
};

const uidOf = (u: User | null) => (u ? u.em : 'guest');

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [data, setDataState] = useState<AppData>(emptyData());
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('bts:user');
      if (raw) setUser(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  /* load data + settings for the active user */
  useEffect(() => {
    let alive = true;
    const key = uidOf(user);
    (async () => {
      const [d, s] = await Promise.all([kvGetAny<AppData>(stateKey(key)), kvGetAny<Settings>(`settings:${key}`)]);
      if (!alive) return;
      setDataState(d && d.subjects ? { ...emptyData(), ...d } : emptyData());
      setSettingsState({ ...DEFAULT_SETTINGS, ...(s || {}) , ai: { ...DEFAULT_AI, ...((s || {}).ai || {}) } });
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  /* persist */
  const persist = useCallback((d: AppData, st: Settings, who: User | null) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      kvSet(stateKey(uidOf(who)), d);
      kvSet(`settings:${uidOf(who)}`, st);
    }, 350);
  }, []);

  useEffect(() => {
    if (!ready) return;
    persist(data, settings, user);
  }, [data, settings, user, ready, persist]);

  /* theme */
  useEffect(() => {
    document.documentElement.classList.toggle('light', settings.theme === 'light');
    document.documentElement.classList.toggle('dark', settings.theme !== 'light');
  }, [settings.theme]);

  const setData = useCallback((fn: (d: AppData) => AppData) => setDataState((d) => fn(d)), []);

  const signIn = useCallback(async (u: User) => {
    try {
      localStorage.setItem('bts:user', JSON.stringify(u));
    } catch {
      /* ignore */
    }
    setUser(u);
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem('bts:user');
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  const setSettings = useCallback((patch: Partial<Settings>) => setSettingsState((s) => ({ ...s, ...patch })), []);
  const setAI = useCallback((patch: Partial<AIConfig>) => setSettingsState((s) => ({ ...s, ai: { ...s.ai, ...patch } })), []);

  const bump = useCallback(
    (points: number) =>
      setDataState((d) => {
        const p = { ...d.profile };
        const t = todayStr();
        if (p.last !== t) {
          const y = new Date();
          y.setDate(y.getDate() - 1);
          p.streak = p.last === todayStr(y) ? p.streak + 1 : 1;
          p.last = t;
          p.best = Math.max(p.best, p.streak);
        }
        p.points += points || 0;
        return { ...d, profile: p };
      }),
    [],
  );

  const addMaterial = useCallback((m: Material) => setDataState((d) => ({ ...d, materials: [m, ...d.materials] })), []);
  const removeMaterial = useCallback(
    (id: string) => setDataState((d) => ({ ...d, materials: d.materials.filter((m) => m.id !== id) })),
    [],
  );
  const addTest = useCallback((t: TestRun) => setDataState((d) => ({ ...d, tests: [t, ...d.tests] })), []);
  const updateTest = useCallback(
    (id: string, patch: Partial<TestRun>) =>
      setDataState((d) => ({ ...d, tests: d.tests.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
    [],
  );
  const addDeck = useCallback((x: Deck) => setDataState((d) => ({ ...d, decks: [x, ...d.decks] })), []);
  const updateDeck = useCallback(
    (id: string, patch: Partial<Deck>) =>
      setDataState((d) => ({ ...d, decks: d.decks.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    [],
  );
  const addNote = useCallback((n: Note) => setDataState((d) => ({ ...d, notes: [n, ...d.notes] })), []);
  const removeNote = useCallback((id: string) => setDataState((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) })), []);

  const addBank = useCallback(
    (items: BankItem[]) =>
      setDataState((d) => {
        if (!items.length) return d;
        const map = new Map<string, BankItem>();
        [...d.bank, ...items].forEach((b) => map.set(b.hash + '|' + b.kind, b));
        return { ...d, bank: [...map.values()].slice(-4000) };
      }),
    [],
  );

  const addMistake = useCallback((q: any, subjectId: string) => {
    setDataState((d) => {
      if (!q?.q) return d;
      const key = norm(q.q);
      const existing = d.mistakes.find((m) => norm(m.question.q) === key);
      const WI = [600000, 86400000, 259200000];
      if (existing) {
        const item: Mistake = { ...existing, box: 0, due: Date.now() + WI[0] };
        return { ...d, mistakes: d.mistakes.map((m) => (m.id === existing.id ? item : m)) };
      }
      const item: Mistake = {
        id: uid('m'),
        subjectId,
        question: { ...q, subjectId },
        box: 0,
        due: Date.now() + WI[0],
        createdAt: Date.now(),
      };
      return { ...d, mistakes: [item, ...d.mistakes].slice(0, 500) };
    });
  }, []);

  const updateMistake = useCallback(
    (id: string, patch: Partial<Mistake>) =>
      setDataState((d) => ({ ...d, mistakes: d.mistakes.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
    [],
  );
  const clearMistake = useCallback(
    (id: string) => setDataState((d) => ({ ...d, mistakes: d.mistakes.filter((m) => m.id !== id) })),
    [],
  );

  const updateMini = useCallback(
    (id: string, fn: (m: MiniState) => MiniState) =>
      setDataState((d) => ({ ...d, mini: { ...d.mini, [id]: fn(d.mini[id] || { a: {}, h: {}, best: 0, tries: 0 }) } })),
    [],
  );

  const addSubject = useCallback(
    (s: Subject) => setDataState((d) => ({ ...d, subjects: [...d.subjects, s] })),
    [],
  );
  const removeSubject = useCallback(
    (id: string) =>
      setDataState((d) => ({
        ...d,
        subjects: d.subjects.filter((s) => s.id !== id),
        materials: d.materials.filter((m) => m.subjectId !== id),
        tests: d.tests.filter((t) => t.subjectId !== id),
        decks: d.decks.filter((x) => x.subjectId !== id),
        notes: d.notes.filter((n) => n.subjectId !== id),
      })),
    [],
  );

  const exportData = useCallback(() => JSON.stringify({ v: 1, data, settings }, null, 2), [data, settings]);
  const importData = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json);
      if (parsed?.data) setDataState({ ...emptyData(), ...parsed.data });
      if (parsed?.settings) setSettingsState({ ...DEFAULT_SETTINGS, ...parsed.settings });
    } catch {
      /* ignore */
    }
  }, []);

  const mastery = useMemo(() => computeMastery(data), [data]);

  const value: Ctx = {
    user,
    data,
    settings,
    ready,
    mastery,
    signIn,
    signOut,
    setSettings,
    setAI,
    setData,
    addMaterial,
    removeMaterial,
    addTest,
    updateTest,
    addDeck,
    updateDeck,
    addNote,
    removeNote,
    addBank,
    addMistake,
    updateMistake,
    clearMistake,
    updateMini,
    bump,
    addSubject,
    removeSubject,
    exportData,
    importData,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export const bankHash = (text: string) => hash(norm(text));
