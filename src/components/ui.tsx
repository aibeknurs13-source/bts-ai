import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

/* --------------------------------------------------------------- toasts */

type ToastKind = 'ok' | 'err' | 'info';
interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}

const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, kind }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-24 left-1/2 z-[90] flex w-[92vw] max-w-md -translate-x-1/2 flex-col gap-2 sm:bottom-8">
        {items.map((i) => (
          <div
            key={i.id}
            className="pop flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-xl"
            style={{
              background: 'var(--surface2)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          >
            <span className="mt-0.5 shrink-0">
              {i.kind === 'ok' ? (
                <CheckCircle2 size={17} style={{ color: 'var(--ok)' }} />
              ) : i.kind === 'err' ? (
                <TriangleAlert size={17} style={{ color: 'var(--bad)' }} />
              ) : (
                <Info size={17} style={{ color: 'var(--a1)' }} />
              )}
            </span>
            <span className="flex-1 leading-snug">{i.text}</span>
            <button
              onClick={() => setItems((s) => s.filter((x) => x.id !== i.id))}
              className="shrink-0 opacity-50 transition hover:opacity-100"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------------------------------------------------------- modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{ background: 'rgba(3,6,12,.62)' }}
        onClick={onClose}
      />
      <div
        className="rise relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] border sm:rounded-[28px]"
        style={{
          background: 'var(--bg2)',
          borderColor: 'var(--border)',
          boxShadow: '0 30px 90px rgba(0,0,0,.6)',
          maxWidth: wide ? 860 : 620,
        }}
      >
        {title && (
          <div
            className="flex items-center justify-between gap-3 border-b px-5 py-4"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="text-base font-extrabold">{title}</div>
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl border transition hover:brightness-125"
              style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}
              aria-label="Закрыть"
            >
              <X size={17} />
            </button>
          </div>
        )}
        <div className="safe-b overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- pieces */

export function LevelBadge({ level, size = 'md' }: { level: string; size?: 'sm' | 'md' }) {
  const color = level === 'A' ? 'var(--lA)' : level === 'B' ? 'var(--lB)' : 'var(--lC)';
  const dim = size === 'sm' ? 22 : 26;
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-lg font-extrabold text-white"
      style={{
        width: dim,
        height: dim,
        background: `color-mix(in srgb, ${color} 24%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 60%, transparent)`,
        color,
        fontSize: size === 'sm' ? 12 : 14,
      }}
      title={`Уровень ${level}`}
    >
      {level}
    </span>
  );
}

export function Ring({ value, size = 56, stroke = 6, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringgrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)' }}
        />
        <defs>
          <linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--a1)" />
            <stop offset="100%" stopColor="var(--a2)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center leading-none">
        <div className="text-sm font-extrabold">{label ?? Math.round(pct * 100) + '%'}</div>
      </div>
    </div>
  );
}

export function Stat({ icon, value, label, accent }: { icon: React.ReactNode; value: React.ReactNode; label: string; accent?: string }) {
  return (
    <div className="card flex items-center gap-3 !p-3.5">
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg"
        style={{ background: `color-mix(in srgb, ${accent || 'var(--a1)'} 16%, transparent)`, color: accent || 'var(--a1)' }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-lg font-extrabold leading-tight">{value}</div>
        <div className="truncate text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
          {label}
        </div>
      </div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-10 text-center">
      <div
        className="grid h-14 w-14 place-items-center rounded-2xl text-2xl"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
      >
        {icon}
      </div>
      <div>
        <div className="font-extrabold">{title}</div>
        {text && (
          <div className="mx-auto mt-1 max-w-sm text-sm" style={{ color: 'var(--muted)' }}>
            {text}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      className="flex gap-1.5 overflow-x-auto rounded-2xl border p-1.5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {items.map((i) => (
        <button
          key={i.id}
          onClick={() => onChange(i.id)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold transition"
          style={{
            background: value === i.id ? 'linear-gradient(135deg,var(--a1),var(--a2))' : 'transparent',
            color: value === i.id ? '#06131a' : 'var(--muted)',
          }}
        >
          {i.icon}
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
      {children}
      {hint && (
        <div className="mt-1.5 text-[11.5px] leading-snug" style={{ color: 'var(--muted)' }}>
          {hint}
        </div>
      )}
    </label>
  );
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="relative h-7 w-12 shrink-0 rounded-full border transition"
      style={{
        background: on ? 'linear-gradient(135deg,var(--a1),var(--a2))' : 'var(--surface3)',
        borderColor: 'var(--border)',
      }}
      aria-pressed={on}
    >
      <span
        className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
        style={{ left: on ? 26 : 3, boxShadow: '0 2px 6px rgba(0,0,0,.4)' }}
      />
    </button>
  );
}
