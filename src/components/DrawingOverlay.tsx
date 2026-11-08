import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, Highlighter, Pencil, RotateCcw, Trash2, X } from 'lucide-react';

const COLORS = ['#ef4444', '#f59e0b', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ffffff'];

interface Stroke {
  t: 'p' | 'm' | 'e';
  c: string;
  s: number;
  p: [number, number][];
}

export default function DrawingOverlay({
  enabled,
  onToggle,
  storeKey,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  storeKey: string;
}) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<'p' | 'm' | 'e'>('p');
  const [color, setColor] = useState('#ef4444');
  const [size, setSize] = useState(4);
  const [pan, setPan] = useState(false);
  const strokes = useRef<Stroke[]>([]);
  const cur = useRef<Stroke | null>(null);
  const raf = useRef(0);

  const save = useCallback(() => {
    try {
      localStorage.setItem('bts:draw:' + storeKey, JSON.stringify(strokes.current));
    } catch {
      /* ignore */
    }
  }, [storeKey]);

  const draw = useCallback(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const all = cur.current ? [...strokes.current, cur.current] : strokes.current;
    all.forEach((k) => {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = k.s;
      if (k.t === 'e') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = '#000';
      } else {
        ctx.strokeStyle = k.c;
        if (k.t === 'm') ctx.globalAlpha = 0.35;
      }
      ctx.beginPath();
      k.p.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      if (k.p.length === 1) ctx.lineTo(k.p[0][0] + 0.01, k.p[0][1]);
      ctx.stroke();
      ctx.restore();
    });
  }, []);

  const resize = useCallback(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = document.documentElement.clientWidth;
    const h = Math.max(document.body.scrollHeight, window.innerHeight);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }, [draw]);

  useEffect(() => {
    if (!enabled) return;
    try {
      const raw = localStorage.getItem('bts:draw:' + storeKey);
      strokes.current = raw ? JSON.parse(raw) : [];
    } catch {
      strokes.current = [];
    }
    resize();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize);
    };
  }, [enabled, storeKey, resize]);

  const pt = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect();
    return [Math.round((e.clientX - r.left) * 10) / 10, Math.round((e.clientY - r.top) * 10) / 10] as [number, number];
  };

  const down = (e: React.PointerEvent) => {
    if (pan) return;
    e.preventDefault();
    try {
      cv.current!.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    cur.current = { t: tool, c: color, s: tool === 'm' ? size * 3 : tool === 'e' ? size * 2 : size, p: [pt(e)] };
    draw();
  };

  const move = (e: React.PointerEvent) => {
    if (!cur.current) return;
    e.preventDefault();
    cur.current.p.push(pt(e));
    if (!raf.current) raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      draw();
    });
  };

  const up = () => {
    if (cur.current) {
      strokes.current = [...strokes.current, cur.current];
      cur.current = null;
      save();
      draw();
    }
  };

  if (!enabled) return null;

  return (
    <>
      <canvas
        ref={cv}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 55,
          pointerEvents: pan ? 'none' : 'auto',
          cursor: pan ? 'grab' : tool === 'e' ? 'cell' : 'crosshair',
          touchAction: 'none',
        }}
      />
      <div
        className="fixed bottom-24 left-1/2 z-[56] flex max-w-[94vw] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl border px-2.5 py-2 backdrop-blur-xl lg:bottom-6"
        style={{ background: 'var(--surface2)', borderColor: 'var(--border)', boxShadow: '0 10px 34px rgba(0,0,0,.45)' }}
      >
        <button className="chip" onClick={() => setTool('p')} style={tool === 'p' ? { background: 'var(--a2)', color: '#fff', borderColor: 'transparent' } : undefined}>
          <Pencil size={14} />
        </button>
        <button className="chip" onClick={() => setTool('m')} style={tool === 'm' ? { background: 'var(--a2)', color: '#fff', borderColor: 'transparent' } : undefined}>
          <Highlighter size={14} />
        </button>
        <button className="chip" onClick={() => setTool('e')} style={tool === 'e' ? { background: 'var(--a2)', color: '#fff', borderColor: 'transparent' } : undefined}>
          <Eraser size={14} />
        </button>
        <span className="mx-1 h-6 w-px" style={{ background: 'var(--border)' }} />
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setColor(c);
              setTool('p');
            }}
            className="h-6 w-6 rounded-full border transition"
            style={{ background: c, borderColor: color === c ? '#fff' : 'var(--border2)', transform: color === c ? 'scale(1.15)' : undefined }}
            aria-label={`Цвет ${c}`}
          />
        ))}
        <input type="range" min={1} max={26} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-20 accent-[var(--a2)]" />
        <span className="mx-1 h-6 w-px" style={{ background: 'var(--border)' }} />
        <button
          className="chip"
          onClick={() => {
            strokes.current.pop();
            draw();
            save();
          }}
          title="Отменить"
        >
          <RotateCcw size={14} />
        </button>
        <button
          className="chip"
          onClick={() => {
            strokes.current = [];
            draw();
            save();
          }}
          title="Очистить"
        >
          <Trash2 size={14} />
        </button>
        <button
          className="chip"
          onClick={() => {
            onToggle(false);
          }}
          style={{ background: 'var(--a1)', color: '#06131a', borderColor: 'transparent' }}
        >
          <X size={14} /> Готово
        </button>
      </div>
    </>
  );
}
