import { useMemo, useState } from 'react';
import { Database, Search, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { Empty, LevelBadge } from './ui';
import { fmtDate } from '../lib/util';

export default function BankView() {
  const { data, setData } = useStore();
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState<string>('all');

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.bank
      .filter((b) => (subject === 'all' ? true : b.subjectId === subject))
      .filter((b) => (s ? (b.stem || b.text).toLowerCase().includes(s) : true))
      .slice()
      .reverse();
  }, [data.bank, q, subject]);

  const byLevel = useMemo(() => {
    const m: Record<string, number> = { A: 0, B: 0, C: 0 };
    data.bank.forEach((b) => {
      m[b.level] = (m[b.level] || 0) + 1;
    });
    return m;
  }, [data.bank]);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: 'color-mix(in srgb,var(--a2) 18%, transparent)', color: 'var(--a2)' }}>
            <Database size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold">Банк вопросов</h1>
            <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
              {data.bank.length} вопросов и карточек, которые ИИ уже использовал — повторы блокируются автоматически
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {(['A', 'B', 'C'] as const).map((l) => (
              <span key={l} className="chip">
                <LevelBadge level={l} size="sm" /> {byLevel[l] || 0}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="card flex flex-wrap gap-2 !py-3">
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input className="input pl-9" placeholder="Поиск по вопросам…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="chip" onClick={() => setSubject('all')} style={subject === 'all' ? { background: 'linear-gradient(135deg,var(--a1),var(--a2))', color: '#06131a', borderColor: 'transparent' } : undefined}>
          Все
        </button>
        {data.subjects.map((s) => (
          <button
            key={s.id}
            className="chip"
            onClick={() => setSubject(s.id)}
            style={subject === s.id ? { background: `linear-gradient(135deg,${s.color},color-mix(in srgb,${s.color} 55%, #000))`, color: '#fff', borderColor: 'transparent' } : undefined}
          >
            {s.emoji} {s.ru}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <Empty icon={<Database size={24} />} title="Банк пуст" text="Сгенерируйте тесты или карточки — здесь появится всё, что ИИ уже использовал." />
      ) : (
        <div className="space-y-2">
          {items.slice(0, 300).map((b) => (
            <div key={b.id} className="card flex items-start gap-3 !py-3">
              <LevelBadge level={b.level} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold leading-snug">{b.stem || b.text}</div>
                <div className="mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>
                  {b.kind === 'q' ? 'вопрос' : 'карточка'} · {b.topic} · {fmtDate(b.createdAt)}
                </div>
              </div>
              <button
                className="shrink-0 opacity-60 hover:opacity-100"
                onClick={() => setData((d) => ({ ...d, bank: d.bank.filter((x) => x.id !== b.id) }))}
                title="Удалить из банка"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {items.length > 300 && (
            <div className="text-center text-[12px]" style={{ color: 'var(--muted)' }}>
              Показаны первые 300 из {items.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
