import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { calcEval, calcFmt } from '../lib/calc';

const ROWS = [
  ['DEG', 'sin', 'cos', 'tan', 'C'],
  ['π', 'asin', 'acos', 'atan', '⌫'],
  ['e', 'ln', 'log', '√', 'abs'],
  ['(', ')', '%', '!', '÷'],
  ['7', '8', '9', '×', '^'],
  ['4', '5', '6', '−', 'x²'],
  ['1', '2', '3', '+', '1/x'],
  ['0', '.', '×10ˣ', 'ANS', '='],
];

export default function Calculator({ onClose }: { onClose: () => void }) {
  const [expr, setExpr] = useState('');
  const [out, setOut] = useState(' ');
  const [err, setErr] = useState(false);
  const [deg, setDeg] = useState(true);
  const ans = useRef(0);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const ins = (t: string) => {
    setExpr((e) => {
      if (t === 'sin' || t === 'cos' || t === 'tan' || t === 'ln' || t === 'log' || t === '√' || t === 'abs' || t === 'asin' || t === 'acos' || t === 'atan') return e + t + '(';
      if (t === 'x²') return e + '^2';
      if (t === '×10ˣ') return e + '*10^(';
      if (t === 'ANS') return e + 'ans';
      return e + t;
    });
    setErr(false);
  };

  const eq = () => {
    if (!expr.trim()) return;
    try {
      const r = calcEval(expr, deg, ans.current);
      const f = calcFmt(r);
      ans.current = r;
      setOut(`${expr} = ${f}`);
      setExpr(f);
      setErr(false);
    } catch {
      setErr(true);
      setOut('Ошибка в выражении');
    }
  };

  const key = (k: string) => {
    if (k === 'C') {
      setExpr('');
      setOut(' ');
      setErr(false);
      return;
    }
    if (k === 'DEG') {
      setDeg((d) => !d);
      return;
    }
    if (k === '=') return eq();
    if (k === '⌫') {
      setExpr((e) => e.slice(0, -1));
      return;
    }
    if (k === '1/x') {
      setExpr((e) => (e ? '1/(' + e + ')' : '1/('));
      return;
    }
    ins(k);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/INPUT|TEXTAREA/.test((e.target as any)?.tagName || '')) return;
      if (e.key === 'Enter') eq();
      else if (e.key === 'Backspace') setExpr((x) => x.slice(0, -1));
      else if (/^[0-9.+\-*/()^%!]$/.test(e.key)) ins(e.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onDown = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    setDrag([e.clientX - r.left, e.clientY - r.top]);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const x = Math.min(Math.max(0, e.clientX - drag[0]), window.innerWidth - (box.current?.offsetWidth || 280));
    const y = Math.min(Math.max(0, e.clientY - drag[1]), window.innerHeight - (box.current?.offsetHeight || 320));
    setPos([x, y]);
  };

  return (
    <div
      ref={box}
      className="fixed z-[60] w-[min(94vw,290px)] rounded-3xl border p-3 shadow-2xl backdrop-blur-xl"
      style={{
        background: 'var(--bg2)',
        borderColor: 'var(--border)',
        right: pos ? undefined : 14,
        bottom: pos ? undefined : 14,
        left: pos ? pos[0] : undefined,
        top: pos ? pos[1] : undefined,
      }}
    >
      <div
        className="mb-2 flex items-center justify-between"
        style={{ cursor: 'move', touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => setDrag(null)}
      >
        <b className="text-[13px]">🧮 Калькулятор</b>
        <button onClick={onClose} className="opacity-60 hover:opacity-100">
          <X size={16} />
        </button>
      </div>
      <input
        className="w-full rounded-2xl border px-3 py-2 text-right font-mono text-lg font-bold"
        style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && eq()}
        inputMode="text"
        spellCheck={false}
      />
      <div className="min-h-[20px] break-words text-right font-mono text-[12px]" style={{ color: err ? 'var(--bad)' : 'var(--muted)' }}>
        {out}
      </div>
      <div className="mt-1 grid grid-cols-5 gap-1.5">
        {ROWS.flat().map((k) => (
          <button
            key={k}
            onClick={() => key(k)}
            className="rounded-xl py-2 text-[13px] font-extrabold transition active:scale-95"
            style={{
              background:
                k === 'DEG' ? 'var(--surface3)' : k === '=' ? 'linear-gradient(135deg,var(--a1),var(--a2))' : /^[+−×÷^]$/.test(k) ? 'color-mix(in srgb,var(--a2) 22%, var(--surface2))' : 'var(--surface2)',
              border: '1px solid var(--border)',
              color: k === '=' ? '#06131a' : 'var(--text)',
            }}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="mt-1 text-[10.5px]" style={{ color: 'var(--muted)' }}>
        Режим: {deg ? 'DEG' : 'RAD'}
      </div>
    </div>
  );
}
