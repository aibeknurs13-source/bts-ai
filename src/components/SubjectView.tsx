import { useMemo, useState } from 'react';
import { BrainCircuit, FileText, FolderOpen, Layers, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import { useStore } from '../store';
import { Route } from '../nav';
import { Empty, LevelBadge, Modal, Tabs, useToast } from './ui';
import { Card, Deck, Level, Note, Question, TestRun } from '../lib/types';
import { uid } from '../lib/util';

export default function SubjectView({
  subjectId,
  tab,
  go,
  openUploader,
  openGenerator,
}: {
  subjectId: string;
  tab?: string;
  go: (r: Route) => void;
  openUploader: (subjectId: string) => void;
  openGenerator: (subjectId: string) => void;
}) {
  const { data, removeMaterial, removeNote, addTest, addDeck, addNote } = useStore();
  const toast = useToast();
  const subject = data.subjects.find((s) => s.id === subjectId);
  const [active, setActive] = useState(tab || 'test');
  const [importOpen, setImportOpen] = useState(false);
  const [raw, setRaw] = useState('');

  const tests = data.tests.filter((t) => t.subjectId === subjectId);
  const decks = data.decks.filter((d) => d.subjectId === subjectId);
  const notes = data.notes.filter((n) => n.subjectId === subjectId);
  const materials = data.materials.filter((m) => m.subjectId === subjectId);
  const mistakes = data.mistakes.filter((m) => m.subjectId === subjectId);

  const doImport = () => {
    try {
      const j = JSON.parse(raw);
      if (Array.isArray(j.questions) && j.questions.length) {
        const qs: Question[] = j.questions.map((q: any, i: number) => ({
          id: uid('q'),
          q: q.q || q.question || '',
          options: (q.options || q.o || []).map((o: any) => (typeof o === 'string' ? o : o?.text || '')),
          answer: typeof q.answer === 'string' ? ['A', 'B', 'C', 'D'].indexOf(q.answer.toUpperCase()) : Number(q.answer ?? q.c ?? 0),
          explanation: q.explanation || q.e || '',
          hint: q.hint,
          level: (q.level || 'A').toUpperCase() as Level,
          topic: q.topic || 'Импорт',
        }));
        const id = uid('t');
        importTest(id, subjectId, qs);
        toast(`Импортировано ${qs.length} вопросов`, 'ok');
      } else if (Array.isArray(j.cards) && j.cards.length) {
        const cs: Card[] = j.cards.map((c: any) => ({
          id: uid('c'),
          front: c.f || c.front || '',
          back: c.b || c.back || '',
          hint: c.h || c.hint,
          level: (c.level || 'A').toUpperCase() as Level,
          topic: c.topic || 'Импорт',
        }));
        importDeck(subjectId, cs);
        toast(`Импортировано ${cs.length} карточек`, 'ok');
      } else if (j.note) {
        importNote(subjectId, String(j.note), j.title);
        toast('Конспект импортирован', 'ok');
      } else {
        toast('Не понял формат. Ожидаются questions / cards / note', 'err');
        return;
      }
      setImportOpen(false);
      setRaw('');
    } catch (e: any) {
      toast('Ошибка JSON: ' + (e?.message || 'неверный формат'), 'err');
    }
  };

  // small helpers that write through the store context
  function importTest(id: string, sid: string, qs: Question[]) {
    addTest({
      id,
      subjectId: sid,
      title: `${subject?.ru || 'Импорт'} · тест`,
      mode: 'MIX',
      questions: qs,
      answers: qs.map(() => null),
      hints: qs.map(() => 0),
      createdAt: Date.now(),
    });
  }
  function importDeck(sid: string, cs: Card[]) {
    addDeck({
      id: uid('d'),
      subjectId: sid,
      title: `${subject?.ru || 'Импорт'} · карточки`,
      cards: cs,
      createdAt: Date.now(),
      learned: 0,
      box: cs.map(() => 0),
      due: Date.now(),
    });
  }
  function importNote(sid: string, md: string, title?: string) {
    addNote({
      id: uid('n'),
      subjectId: sid,
      title: title || `${subject?.ru || 'Импорт'} · конспект`,
      markdown: md,
      miniTests: [],
      createdAt: Date.now(),
    });
  }

  if (!subject) return <div className="card">Предмет не найден.</div>;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl"
          style={{ background: `color-mix(in srgb,${subject.color} 20%, transparent)`, color: subject.color }}
        >
          {subject.emoji}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold">{subject.ru}</h1>
          <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
            {subject.name} · {materials.length} файлов · {tests.length} тестов
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="btn" onClick={() => openGenerator(subjectId)}>
            <Sparkles size={16} /> Сгенерировать с ИИ
          </button>
          <button className="btn-ghost" onClick={() => openUploader(subjectId)}>
            <Upload size={16} /> Файлы
          </button>
        </div>
      </div>

      <Tabs
        value={active}
        onChange={(v) => setActive(v)}
        items={[
          { id: 'test', label: `Тесты (${tests.length})`, icon: <Layers size={14} /> },
          { id: 'cards', label: `Карточки (${decks.length})`, icon: <FileText size={14} /> },
          { id: 'note', label: `Конспекты (${notes.length})`, icon: <FolderOpen size={14} /> },
          { id: 'review', label: `Ошибки (${mistakes.length})`, icon: <BrainCircuit size={14} /> },
        ]}
      />

      {active === 'test' && (
        <div className="space-y-2">
          {tests.length === 0 && (
            <Empty
              icon={<Layers size={24} />}
              title="Тестов пока нет"
              text="Сгенерируйте тест с ИИ — 20–40 вопросов на уровни A, B и C, без повторов."
              action={
                <button className="btn" onClick={() => openGenerator(subjectId)}>
                  <Sparkles size={16} /> Создать тест
                </button>
              }
            />
          )}
          {tests.map((t) => (
            <div key={t.id} className="card flex flex-wrap items-center gap-3 !py-3.5">
              <button className="min-w-0 flex-1 text-left" onClick={() => go({ k: 'test', id: t.id })}>
                <div className="truncate font-extrabold">{t.title}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                    {t.questions.length} вопросов ·{' '}
                    {new Date(t.createdAt).toLocaleDateString('ru-RU')}
                  </span>
                  {(['A', 'B', 'C'] as Level[]).map((l) => {
                    const n = t.questions.filter((q) => q.level === l).length;
                    if (!n) return null;
                    return (
                      <span key={l} className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: 'var(--muted)' }}>
                        <LevelBadge level={l} size="sm" />
                        {n}
                      </span>
                    );
                  })}
                </div>
                {t.adaptiveReason && (
                  <div className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
                    🧠 {t.adaptiveReason}
                  </div>
                )}
              </button>
              {t.finishedAt ? (
                <span className="chip">{t.score}%</span>
              ) : (
                <button className="chip" onClick={() => go({ k: 'test', id: t.id })}>
                  Продолжить
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {active === 'cards' && (
        <div className="space-y-2">
          {decks.length === 0 && (
            <Empty
              icon={<FileText size={24} />}
              title="Карточек пока нет"
              text="ИИ сделает карточки с вопросом и развёрнутым ответом по вашему материалу."
              action={
                <button className="btn" onClick={() => openGenerator(subjectId)}>
                  <Sparkles size={16} /> Создать карточки
                </button>
              }
            />
          )}
          {decks.map((d) => (
            <div key={d.id} className="card flex flex-wrap items-center gap-3 !py-3.5">
              <button className="min-w-0 flex-1 text-left" onClick={() => go({ k: 'cards', id: d.id })}>
                <div className="truncate font-extrabold">{d.title}</div>
                <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                  {d.cards.length} карточек · выучено {d.cards.filter((_, i) => (d.box[i] || 0) > 0).length}
                </div>
              </button>
              <button className="chip" onClick={() => go({ k: 'cards', id: d.id })}>
                Открыть
              </button>
            </div>
          ))}
        </div>
      )}

      {active === 'note' && (
        <div className="space-y-2">
          {notes.length === 0 && (
            <Empty
              icon={<FolderOpen size={24} />}
              title="Конспектов пока нет"
              text="ИИ соберёт структурированный конспект с формулами, терминами и мини-тестами."
              action={
                <button className="btn" onClick={() => openGenerator(subjectId)}>
                  <Sparkles size={16} /> Создать конспект
                </button>
              }
            />
          )}
          {notes.map((n) => (
            <div key={n.id} className="card flex flex-wrap items-center gap-3 !py-3.5">
              <button className="min-w-0 flex-1 text-left" onClick={() => go({ k: 'note', id: n.id })}>
                <div className="truncate font-extrabold">{n.title}</div>
                <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                  {new Date(n.createdAt).toLocaleDateString('ru-RU')} · {(n.miniTests || []).length} мини-тестов
                </div>
              </button>
              <button
                className="chip"
                onClick={() => {
                  if (confirm('Удалить конспект?')) removeNote(n.id);
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {active === 'review' && (
        <div className="space-y-2">
          <div className="card flex flex-wrap items-center gap-3 !py-3.5">
            <div className="min-w-0 flex-1">
              <div className="font-extrabold">Повторение ошибок</div>
              <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                {mistakes.length} в очереди · {mistakes.filter((m) => m.due <= Date.now()).length} к повтору сейчас
              </div>
            </div>
            <button className="btn" onClick={() => go({ k: 'review', subjectId })}>
              <BrainCircuit size={15} /> Начать повторение
            </button>
          </div>
          {materials.length === 0 && (
            <Empty
              icon={<FolderOpen size={24} />}
              title="Нет материалов"
              text="Загрузите файлы по кнопке «Файлы» — ИИ прочитает их и сделает тесты, карточки и конспект."
              action={
                <button className="btn" onClick={() => openUploader(subjectId)}>
                  <Upload size={15} /> Загрузить
                </button>
              }
            />
          )}
        </div>
      )}

      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-extrabold">Файлы предмета</h3>
          <button className="chip ml-auto" onClick={() => openUploader(subjectId)}>
            <Plus size={12} /> Добавить
          </button>
        </div>
        {materials.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {materials.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-2xl border px-3.5 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[10px] font-extrabold uppercase" style={{ background: 'var(--surface2)' }}>
                  {m.kind.slice(0, 4)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold">{m.name}</div>
                  <div className="truncate text-[11px]" style={{ color: 'var(--muted)' }}>
                    {m.text ? `${m.text.length} симв.` : 'изображение'} {m.pages ? `· ${m.pages} стр.` : ''}
                  </div>
                </div>
                <button className="ml-auto shrink-0 opacity-60 hover:opacity-100" onClick={() => removeMaterial(m.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            Файлов нет. Нажмите «Файлы», чтобы загрузить PDF, DOCX, PPTX, XLSX или изображения.
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <button className="chip" onClick={() => setImportOpen(true)}>
          Вставить JSON вручную
        </button>
      </div>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Импорт JSON">
        <textarea
          className="input min-h-[200px] font-mono text-[12px]"
          placeholder='{"questions":[{"q":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]}'
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <button className="btn flex-1" onClick={doImport}>
            Импортировать
          </button>
          <button className="btn-ghost" onClick={() => setImportOpen(false)}>
            Отмена
          </button>
        </div>
      </Modal>
    </div>
  );
}
