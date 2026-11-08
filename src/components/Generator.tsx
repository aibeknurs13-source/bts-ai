import { useEffect, useMemo, useRef, useState } from 'react';
import { BrainCircuit, Check, FileText, KeyRound, Layers, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useStore } from '../store';
import { AIConfig, Level, LevelMode } from '../lib/types';
import { generateCards, generateNoteAll, generateTest } from '../lib/generate';
import { providerReady } from '../lib/ai';
import { adaptiveMix, adaptiveReason } from '../store';
import { hash, norm, uid } from '../lib/util';
import { Field, LevelBadge, Modal, useToast } from './ui';

const MODES: { id: LevelMode; label: string; desc: string }[] = [
  { id: 'A', label: 'Только A', desc: 'База: факты, термины, формулы' },
  { id: 'B', label: 'Только B', desc: 'Средний: применение и расчёты' },
  { id: 'C', label: 'Только C', desc: 'Сложный: многошаговые задачи, всё самое трудное' },
  { id: 'MIX', label: 'A + B + C', desc: 'Смешанный набор с разбором по уровням' },
  { id: 'ADAPT', label: 'Адаптивный', desc: 'ИИ сам подберёт сложность под ваши результаты' },
];

const KINDS = [
  { id: 'test', label: 'Тест', icon: Layers },
  { id: 'cards', label: 'Карточки', icon: FileText },
  { id: 'note', label: 'Конспект', icon: Wand2 },
  { id: 'all', label: 'Всё сразу', icon: Sparkles },
];

export default function Generator({
  open,
  onClose,
  subjectId,
  onSubjectChange,
  presetMaterialIds,
  onDone,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  subjectId: string;
  onSubjectChange: (id: string) => void;
  presetMaterialIds?: string[];
  onDone?: (kind: 'test' | 'cards' | 'note', id: string) => void;
  onOpenSettings?: () => void;
}) {
  const { data, settings, mastery, addTest, addDeck, addNote, addBank, bump } = useStore();
  const toast = useToast();
  const subject = data.subjects.find((s) => s.id === subjectId) || data.subjects[0];

  const [kind, setKind] = useState<'test' | 'cards' | 'note' | 'all'>('test');
  const [mode, setMode] = useState<LevelMode>('MIX');
  const [count, setCount] = useState(20);
  const [useText, setUseText] = useState(false);
  const [pasted, setPasted] = useState('');
  const [picked, setPicked] = useState<string[]>(presetMaterialIds || []);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ stage: '', done: 0, total: 0 });

  /* keep the selected sources in sync with the materials chosen in the uploader */
  const presetKey = (presetMaterialIds || []).join(',');
  const prevSubject = useRef(subjectId);
  useEffect(() => {
    if (!open) return;
    if (presetMaterialIds && presetMaterialIds.length) setPicked([...presetMaterialIds]);
    else if (prevSubject.current !== subjectId) setPicked([]);
    prevSubject.current = subjectId;
    setBusy(false);
    setProgress({ stage: '', done: 0, total: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetKey, subjectId]);

  const materials = data.materials.filter((m) => m.subjectId === subjectId);
  const sourceText = useMemo(() => {
    const parts: string[] = [];
    if (useText && pasted.trim()) parts.push(pasted.trim());
    const chosen = materials.filter((m) => picked.includes(m.id));
    chosen.forEach((m) => {
      if (m.text) parts.push(`### Файл: ${m.name}\n${m.text}`);
      if (m.hasImage && m.imageData) parts.push(`### Изображение: ${m.name} (прочитать визуально)`);
    });
    return parts.join('\n\n');
  }, [useText, pasted, materials, picked]);

  const avoid = useMemo(
    () =>
      data.bank
        .filter((b) => b.subjectId === subjectId)
        .slice(-160)
        .map((b) => b.text),
    [data.bank, subjectId],
  );
  const avoidStems = useMemo(
    () =>
      data.bank
        .filter((b) => b.subjectId === subjectId)
        .slice(-160)
        .map((b) => b.stem || b.text),
    [data.bank, subjectId],
  );

  const cfg: AIConfig = settings.ai;
  const ready = providerReady(cfg);
  const mix = adaptiveMix(mastery);

  const start = async () => {
    if (!sourceText.trim()) {
      toast('Добавьте материал или вставьте текст', 'err');
      return;
    }
    setBusy(true);
    setProgress({ stage: 'Подготовка', done: 0, total: count });
    const base = {
      cfg,
      subjectName: subject.name,
      subjectRu: subject.ru,
      subjectId,
      mode,
      count,
      sourceText,
      avoid,
      avoidStems,
      mastery,
      onProgress: (p: any) => setProgress(p),
    };
    try {
      if (kind === 'test' || kind === 'all') {
        const res = await generateTest(base);
        if (!res.questions.length) throw new Error('ИИ не вернул вопросов. Попробуйте другой материал или модель.');
        const id = uid('t');
        addTest({
          id,
          subjectId,
          title: `${subject.ru} · ${mode === 'ADAPT' ? 'адаптивный тест' : mode === 'MIX' ? 'смешанный тест' : `уровень ${mode}`}`,
          mode,
          questions: res.questions,
          answers: res.questions.map(() => null),
          hints: res.questions.map(() => 0),
          createdAt: Date.now(),
          adaptiveReason: res.reason,
        });
        addBank(
          res.questions.map((q) => ({
            id: uid('b'),
            subjectId,
            topic: q.topic,
            level: q.level,
            kind: 'q' as const,
            text: q.q + ' ' + q.options.join(' '),
            stem: q.q,
            hash: hash(norm(q.q + ' ' + q.options.join(' '))),
            createdAt: Date.now(),
          })),
        );
        bump(2);
        if (kind === 'all') {
          toast(`Тест готов: ${res.questions.length} вопросов`, 'ok');
        } else {
          toast(`Тест готов: ${res.questions.length} вопросов`, 'ok');
          setBusy(false);
          onClose();
          onDone?.('test', id);
          return;
        }
      }
      if (kind === 'cards' || kind === 'all') {
        const cards = await generateCards(base);
        if (!cards.length) throw new Error('ИИ не вернул карточек.');
        const id = uid('d');
        addDeck({
          id,
          subjectId,
          title: `${subject.ru} · карточки`,
          cards,
          createdAt: Date.now(),
          learned: 0,
          box: cards.map(() => 0),
          due: Date.now(),
        });
        addBank(
          cards.map((c) => ({
            id: uid('b'),
            subjectId,
            topic: c.topic,
            level: c.level,
            kind: 'c' as const,
            text: c.front + ' ' + c.back,
            stem: c.front,
            hash: hash(norm(c.front + ' ' + c.back)),
            createdAt: Date.now(),
          })),
        );
        bump(2);
        if (kind !== 'all') {
          toast(`Карточки готовы: ${cards.length}`, 'ok');
          setBusy(false);
          onClose();
          onDone?.('cards', id);
          return;
        }
        toast(`Карточки готовы: ${cards.length}`, 'ok');
      }
      if (kind === 'note' || kind === 'all') {
        const n = await generateNoteAll(base);
        if (!n.markdown) throw new Error('ИИ не вернул конспект.');
        const id = uid('n');
        addNote({
          id,
          subjectId,
          title: n.title,
          markdown: n.markdown,
          miniTests: n.miniTests,
          createdAt: Date.now(),
        });
        bump(2);
        if (kind !== 'all') {
          toast('Конспект готов', 'ok');
          setBusy(false);
          onClose();
          onDone?.('note', id);
          return;
        }
        toast('Конспект готов', 'ok');
      }
      setBusy(false);
      onClose();
      if (kind === 'all') {
        const t = data.tests[0];
        if (t) onDone?.('test', t.id);
      }
    } catch (e: any) {
      const msg = e?.message || 'Ошибка генерации';
      toast(e?.hint ? `${msg} — ${e.hint}` : msg, 'err');
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="ИИ-генератор" wide>
      {busy ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="relative">
            <div className="grid h-20 w-20 place-items-center rounded-3xl" style={{ background: 'linear-gradient(135deg,var(--a1),var(--a2))' }}>
              <Loader2 size={32} className="spin text-[#06131a]" />
            </div>
          </div>
          <div className="text-base font-extrabold">{progress.stage || 'Генерирую…'}</div>
          <div className="w-full max-w-sm">
            <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface3)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, progress.total ? (progress.done / progress.total) * 100 : 8)}%`,
                  background: 'linear-gradient(90deg,var(--a1),var(--a2))',
                }}
              />
            </div>
            <div className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
              {progress.total ? `${progress.done} / ${progress.total}` : 'Анализирую материал'} · не закрывайте окно
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {!ready && (
            <div className="rounded-2xl border p-3.5 text-sm" style={{ borderColor: 'color-mix(in srgb,var(--warn) 45%, transparent)', background: 'color-mix(in srgb,var(--warn) 10%, transparent)' }}>
              <b>ИИ-провайдер не настроен.</b> Работает локальный режим (вопросы и карточки из вашего материала). Чтобы получить настоящий ИИ-конспект и сложные вопросы — добавьте бесплатный ключ в{' '}
              <b>Настройках</b>.
              {onOpenSettings && (
                <button className="btn-ghost mt-2.5 w-full sm:w-auto" onClick={onOpenSettings}>
                  <KeyRound size={15} /> Открыть настройки
                </button>
              )}
            </div>
          )}
          {cfg.provider === 'local' && (
            <div className="rounded-2xl border p-3.5 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              Режим: <b>локальный</b> — генерация без сети и без ключа. Качество ниже, чем у ИИ, зато полностью бесплатно и мгновенно.
            </div>
          )}

          {/* subject */}
          <div>
            <div className="mb-2 text-xs font-extrabold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Предмет
            </div>
            <div className="flex flex-wrap gap-2">
              {data.subjects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSubjectChange(s.id)}
                  className="chip"
                  style={
                    subjectId === s.id
                      ? { background: `linear-gradient(135deg,${s.color},color-mix(in srgb,${s.color} 55%, #000))`, color: '#fff', borderColor: 'transparent' }
                      : undefined
                  }
                >
                  {s.emoji} {s.ru}
                </button>
              ))}
            </div>
          </div>

          {/* what */}
          <div>
            <div className="mb-2 text-xs font-extrabold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Что создать
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setKind(k.id as any)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-[13px] font-bold transition"
                  style={{
                    borderColor: kind === k.id ? 'var(--a2)' : 'var(--border)',
                    background: kind === k.id ? 'color-mix(in srgb,var(--a2) 14%, transparent)' : 'var(--surface)',
                    color: kind === k.id ? 'var(--text)' : 'var(--muted)',
                  }}
                >
                  <k.icon size={18} style={{ color: kind === k.id ? 'var(--a2)' : undefined }} />
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          {/* level */}
          <div>
            <div className="mb-2 text-xs font-extrabold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Уровень сложности
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className="flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition"
                  style={{
                    borderColor: mode === m.id ? 'var(--a2)' : 'var(--border)',
                    background: mode === m.id ? 'color-mix(in srgb,var(--a2) 12%, transparent)' : 'var(--surface)',
                  }}
                >
                  {['A', 'B', 'C'].includes(m.id) ? (
                    <LevelBadge level={m.id} />
                  ) : (
                    <div className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg" style={{ background: 'var(--surface3)' }}>
                      {m.id === 'ADAPT' ? <BrainCircuit size={14} /> : <Layers size={14} />}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[13px] font-extrabold">{m.label}</div>
                    <div className="truncate text-[11.5px]" style={{ color: 'var(--muted)' }}>
                      {m.desc}
                    </div>
                  </div>
                  {mode === m.id && <Check size={16} className="ml-auto shrink-0" style={{ color: 'var(--a1)' }} />}
                </button>
              ))}
            </div>
            {mode === 'ADAPT' && (
              <div className="mt-2 rounded-2xl border p-3 text-[12px]" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <b>Адаптивный режим:</b> {adaptiveReason(mastery, mix)}
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['A', 'B', 'C'] as Level[]).map((l) => (
                    <span key={l} className="chip">
                      <LevelBadge level={l} size="sm" /> {Math.round(mix[l] * 100)}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* count */}
          {(kind === 'test' || kind === 'cards' || kind === 'all') && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-extrabold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                  Количество
                </div>
                <div className="text-sm font-extrabold">{count}</div>
              </div>
              <input
                type="range"
                min={20}
                max={40}
                step={1}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full accent-[var(--a2)]"
              />
              <div className="mt-1 flex justify-between text-[11px]" style={{ color: 'var(--muted)' }}>
                <span>20</span>
                <span>30</span>
                <span>40</span>
              </div>
            </div>
          )}

          {/* source */}
          <div>
            <div className="mb-2 text-xs font-extrabold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Источник
            </div>
            {materials.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {materials.map((m) => {
                  const on = picked.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPicked((s) => (on ? s.filter((x) => x !== m.id) : [...s, m.id]))}
                      className="chip"
                      style={on ? { background: 'linear-gradient(135deg,var(--a1),var(--a2))', color: '#06131a', borderColor: 'transparent' } : undefined}
                    >
                      {on && <Check size={13} />}
                      {m.name.length > 22 ? m.name.slice(0, 22) + '…' : m.name}
                    </button>
                  );
                })}
              </div>
            )}
            {materials.length === 0 && !useText && (
              <div className="rounded-2xl border p-3 text-[12.5px]" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                В библиотеке предмета пока нет файлов — нажмите «+», чтобы загрузить PDF/DOCX/PPTX, или вставьте текст ниже.
              </div>
            )}
            <button className="chip mt-2" onClick={() => setUseText((v) => !v)}>
              {useText ? 'Скрыть текст' : '+ Вставить свой текст'}
            </button>
            {useText && (
              <textarea
                className="input mt-2 min-h-[120px] font-mono text-[12.5px]"
                placeholder="Вставьте лекцию, конспект или вопросы — ИИ разберёт их по темам"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
              />
            )}
            <div className="mt-2 text-[11.5px]" style={{ color: 'var(--muted)' }}>
              Источник: {sourceText.trim() ? `${sourceText.trim().length} симв.` : 'ничего не выбрано'}
              {avoid.length > 0 ? ` · в банке уже ${avoid.length} вопросов (повторы запрещены)` : ''}
            </div>
          </div>

          <button className="btn w-full" onClick={start} disabled={!sourceText.trim()}>
            <Sparkles size={16} />
            Сгенерировать
          </button>
        </div>
      )}
    </Modal>
  );
}
