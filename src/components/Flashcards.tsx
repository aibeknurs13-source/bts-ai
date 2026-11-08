import { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, Sparkles } from 'lucide-react';
import { useStore } from '../store';
import { LevelBadge } from './ui';
import { shuffle } from '../lib/util';

export default function Flashcards({ deckId, onExit }: { deckId: string; onExit: () => void }) {
  const { data, updateDeck, bump } = useStore();
  const deck = data.decks.find((d) => d.id === deckId);
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [flip, setFlip] = useState(false);
  const [showLevel, setShowLevel] = useState<boolean>(false);

  useEffect(() => {
    if (!deck) return;
    const idx = deck.cards.map((_, i) => i);
    setOrder(shuffle(idx));
    setPos(0);
    setFlip(false);
  }, [deck?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/INPUT|TEXTAREA/.test((e.target as any)?.tagName || '')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setFlip((f) => !f);
      }
      if (e.key === 'ArrowRight') rate(1);
      if (e.key === 'ArrowLeft') rate(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const cards = deck?.cards || [];
  const current = order[pos] !== undefined ? cards[order[pos]] : null;

  const rate = (k: 1 | 0) => {
    if (!deck || !current) return;
    const boxes = deck.box.slice();
    const i = order[pos];
    const WI = [600000, 86400000, 259200000, 604800000];
    if (k) {
      boxes[i] = Math.min(WI.length - 1, (boxes[i] || 0) + 1);
      bump(Math.max(1, 3 - boxes[i]));
    } else {
      boxes[i] = 0;
      bump(0);
    }
    updateDeck(deck.id, { box: boxes, learned: boxes.filter((b) => b > 0).length });
    setFlip(false);
    setPos((p) => (p + 1) % Math.max(1, order.length));
  };

  const progress = useMemo(() => {
    if (!deck) return 0;
    const done = deck.cards.filter((_, i) => (deck.box[i] || 0) > 0).length;
    return deck.cards.length ? done / deck.cards.length : 0;
  }, [deck]);

  if (!deck) {
    return (
      <div className="card">
        Колода не найдена.
        <button className="btn-ghost mt-3" onClick={onExit}>
          Назад
        </button>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="card flex flex-col items-center gap-3 py-10 text-center">
        <Sparkles size={34} style={{ color: 'var(--a1)' }} />
        <div className="text-lg font-extrabold">Карточек пока нет</div>
        <button className="btn-ghost" onClick={onExit}>
          Назад
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-3 !py-3">
        <div className="min-w-0">
          <div className="truncate font-extrabold">{deck.title}</div>
          <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
            Выучено {deck.cards.filter((_, i) => (deck.box[i] || 0) > 0).length} из {deck.cards.length} · карточка {pos + 1}/{order.length}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <LevelBadge level={current.level} size="sm" />
          <button className="chip" onClick={() => setShowLevel((v) => !v)}>
            {showLevel ? 'Скрыть' : 'Уровни'}
          </button>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface3)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress * 100}%`, background: 'linear-gradient(90deg,var(--a1),var(--a2))' }} />
      </div>

      {showLevel && (
        <div className="flex flex-wrap gap-2">
          {(['A', 'B', 'C'] as const).map((l) => (
            <span key={l} className="chip">
              <LevelBadge level={l} size="sm" /> {cards.filter((c) => c.level === l).length}
            </span>
          ))}
        </div>
      )}

      <div className="grid place-items-center" style={{ perspective: '1200px' }}>
        <div
          onClick={() => setFlip((f) => !f)}
          className="relative w-full max-w-xl transition-transform duration-500"
          style={{ transformStyle: 'preserve-3d', transform: flip ? 'rotateY(180deg)' : 'none', cursor: 'pointer' }}
        >
          <div className="card flex min-h-[240px] flex-col items-center justify-center gap-3 text-center" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(0deg)' }}>
            <div className="text-[11px] font-extrabold uppercase tracking-[.18em]" style={{ color: 'var(--muted)' }}>
              Вопрос
            </div>
            <div className="max-w-md text-[19px] font-extrabold leading-snug">{current.front}</div>
            {current.hint && (
              <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
                {current.hint}
              </div>
            )}
          </div>
          <div
            className="card absolute inset-0 flex min-h-[240px] flex-col items-center justify-center gap-3 text-center"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: 'linear-gradient(140deg,color-mix(in srgb,var(--a2) 22%,var(--bg2)),var(--bg2))' }}
          >
            <div className="text-[11px] font-extrabold uppercase tracking-[.18em]" style={{ color: 'var(--a1)' }}>
              Ответ
            </div>
            <div className="max-w-md whitespace-pre-line text-[15px] leading-relaxed">{current.back}</div>
          </div>
        </div>
      </div>

      <p className="text-center text-[12px]" style={{ color: 'var(--muted)' }}>
        Нажмите на карточку (или пробел), чтобы перевернуть
      </p>

      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={() => rate(0)}>
          <RotateCcw size={15} /> Ещё раз
        </button>
        <button className="btn flex-1" onClick={() => rate(1)}>
          <Check size={15} /> Знаю
        </button>
      </div>

      <div className="flex justify-center">
        <button className="chip" onClick={onExit}>
          К списку колод
        </button>
      </div>
    </div>
  );
}
