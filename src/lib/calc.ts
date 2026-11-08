/** Scientific calculator engine (ported from the original site) — DEG/RAD, trig, logs, factorials. */

export function calcEval(src: string, deg: boolean, ans: number): number {
  const s = String(src)
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/,/g, '.')
    .replace(/π/g, ' pi ')
    .replace(/√/g, ' sqrt ')
    .toLowerCase();
  const T: string[] = [];
  const re = /\s*(\d+\.?\d*|\.\d+|[a-z]+|[-+*/^()!%])/y;
  let i = 0;
  let m: RegExpExecArray | null;
  while (i < s.length) {
    re.lastIndex = i;
    m = re.exec(s);
    if (!m) {
      if (/^\s*$/.test(s.slice(i))) break;
      throw new Error('tok');
    }
    T.push(m[1]);
    i = re.lastIndex;
  }
  if (!T.length) throw new Error('empty');
  let p = 0;
  const pk = () => T[p];
  const nx = () => T[p++];
  const R = (x: number) => (deg ? (x * Math.PI) / 180 : x);
  const D = (x: number) => (deg ? (x * 180) / Math.PI : x);
  const Z = (r: number) => (Math.abs(r) < 1e-12 ? 0 : r);
  const F: Record<string, (x: number) => number> = {
    sin: (x) => Z(Math.sin(R(x))),
    cos: (x) => Z(Math.cos(R(x))),
    tan: (x) => {
      const c = Math.cos(R(x));
      if (Math.abs(c) < 1e-12) throw new Error('tan');
      return Z(Math.sin(R(x)) / c);
    },
    asin: (x) => D(Math.asin(x)),
    acos: (x) => D(Math.acos(x)),
    atan: (x) => D(Math.atan(x)),
    ln: Math.log,
    log: Math.log10,
    sqrt: Math.sqrt,
    abs: Math.abs,
  };
  const fact = (n: number) => {
    if (n < 0 || n !== Math.floor(n) || n > 170) throw new Error('fact');
    let r = 1;
    for (let k = 2; k <= n; k++) r *= k;
    return r;
  };
  const close = () => {
    if (pk() === ')') nx();
  };
  function expr(): number {
    let v = term();
    while (pk() === '+' || pk() === '-') v = nx() === '+' ? v + term() : v - term();
    return v;
  }
  function term(): number {
    let v = unary();
    for (;;) {
      const t = pk();
      if (t === '*') {
        nx();
        v *= unary();
      } else if (t === '/') {
        nx();
        v /= unary();
      } else if (t !== undefined && (t === '(' || /^[\d.a-z]/.test(t))) v *= unary();
      else return v;
    }
  }
  function unary(): number {
    if (pk() === '-') {
      nx();
      return -unary();
    }
    if (pk() === '+') {
      nx();
      return unary();
    }
    return pow();
  }
  function pow(): number {
    const b = post();
    if (pk() === '^') {
      nx();
      return Math.pow(b, unary());
    }
    return b;
  }
  function post(): number {
    let v = atom();
    for (;;) {
      if (pk() === '!') {
        nx();
        v = fact(v);
      } else if (pk() === '%') {
        nx();
        v /= 100;
      } else return v;
    }
  }
  function atom(): number {
    const t = nx();
    if (t === undefined) throw new Error('end');
    if (/^[\d.]/.test(t)) return parseFloat(t);
    if (t === '(') {
      const v = expr();
      close();
      return v;
    }
    if (t === 'pi') return Math.PI;
    if (t === 'e') return Math.E;
    if (t === 'ans') return ans || 0;
    if (F[t]) {
      let a: number;
      if (pk() === '(') {
        nx();
        a = expr();
        close();
      } else a = unary();
      return F[t](a);
    }
    throw new Error('bad ' + t);
  }
  const v = expr();
  if (p < T.length) throw new Error('extra');
  if (!isFinite(v) || isNaN(v)) throw new Error('nan');
  return parseFloat(v.toPrecision(12));
}

export function calcFmt(r: number): string {
  if (r !== 0 && (Math.abs(r) >= 1e15 || Math.abs(r) < 1e-6)) {
    const [m, e] = r.toExponential(6).split('e');
    return m.replace(/\.?0+$/, '') + '×10^(' + parseInt(e, 10) + ')';
  }
  return String(r);
}
