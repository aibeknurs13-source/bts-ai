import renderMathInElement from 'katex/contrib/auto-render';

export const esc = (s: any) =>
  String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* --------------------------------------------------------------- figures */

const st = (r: number) => {
  const d = r / 8;
  const m = 10 ** Math.floor(Math.log10(d));
  return [1, 2, 5, 10].map((k) => k * m).find((k) => k >= d) ?? 1;
};

const cf = (s: string) => {
  s = String(s).replace(/\^/g, '**');
  if (/[^\dxy\s.+\-*/()]/.test(s.replace(/sqrt|abs|sin|cos|ln|exp|pi/g, ''))) return () => NaN;
  try {
    const f = Function('x', 'y', 'sqrt', 'abs', 'sin', 'cos', 'ln', 'exp', 'pi', 'return(' + s + ')');
    return (x: number, y: number) => f(x, y, Math.sqrt, Math.abs, Math.sin, Math.cos, Math.log, Math.exp, Math.PI);
  } catch {
    return () => NaN;
  }
};

export function fig(g: any): string {
  if (g?.img) {
    const u = String(g.img).replace(/"/g, '');
    return `<img class="fig wide pic" src="${u}" alt="">`;
  }
  if (!g || !Array.isArray(g.x) || !Array.isArray(g.y)) return '';
  const W = 280,
    H = 210;
  const [a, b] = g.x,
    [c, d] = g.y;
  const X = (x: number) => ((x - a) / (b - a)) * W;
  const Y = (y: number) => H - ((y - c) / (d - c)) * H;
  const gx = st(b - a),
    gy = st(d - c);
  let s = '';
  for (let v = Math.ceil(a / gx) * gx; v <= b + 1e-9; v += gx)
    s += `<path d="M${X(v)} 0V${H}" stroke="#8884"/><text x="${X(v) + 2}" y="${Math.min(Math.max(Y(0) + 10, 10), H - 2)}" font-size="9" fill="#9aa">${+v.toFixed(2)}</text>`;
  for (let v = Math.ceil(c / gy) * gy; v <= d + 1e-9; v += gy)
    s += `<path d="M0 ${Y(v)}H${W}" stroke="#8884"/><text x="${Math.min(Math.max(X(0) + 3, 0), W - 18)}" y="${Y(v) - 2}" font-size="9" fill="#9aa">${+v.toFixed(2)}</text>`;
  const sh = [].concat(g.shade || []).map((t: string) => {
    const p = String(t).split(/(<=|>=|<|>)/);
    return [cf(p[0]), p[1], cf(p[2])];
  });
  if (sh.length) {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const k = cv.getContext('2d')!;
    k.fillStyle = 'rgba(129,140,248,.45)';
    for (let i = 0; i < W; i += 2)
      for (let j = 0; j < H; j += 2) {
        const x = a + ((i + 1) / W) * (b - a);
        const y = d - ((j + 1) / H) * (d - c);
        if (
          sh.every(([f, o, h]: any) => {
            const u = f(x, y),
              v = h(x, y);
            return o == '>' ? u > v : o == '<' ? u < v : o == '>=' ? u >= v : u <= v;
          })
        )
          k.fillRect(i, j, 2, 2);
      }
    s += `<image href="${cv.toDataURL()}" width="${W}" height="${H}"/>`;
  }
  s += `<path d="M0 ${Y(0)}H${W}M${X(0)} 0V${H}" stroke="#bbb" stroke-width="1.3"/>`;
  [].concat(g.fn || []).forEach((o: any) => {
    const f = cf(o.f);
    let p = '',
      u = 0;
    for (let i = 0; i <= 200; i++) {
      const x = a + (i / 200) * (b - a);
      const y = f(x, 0);
      if (isFinite(y) && Math.abs(y - (c + d) / 2) < 4 * (d - c)) {
        p += (u ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1);
        u = 1;
      } else u = 0;
    }
    s += `<path d="${p}" fill="none" stroke="#a5b4fc" stroke-width="2"${o.d ? ' stroke-dasharray="6 4"' : ''}/>`;
  });
  [].concat(g.ci || []).forEach((o: any) =>
    s += `<ellipse cx="${X(o[0])}" cy="${Y(o[1])}" rx="${(o[2] * W) / (b - a)}" ry="${(o[2] * H) / (d - c)}" fill="none" stroke="#a5b4fc" stroke-width="2"${
      o[3] ? ' stroke-dasharray="6 4"' : ''
    }/>`,
  );
  if (g.lx) s += `<text x="${W - 4}" y="${H - 4}" text-anchor="end" font-size="11" fill="#cbd5e1">${esc(g.lx)}</text>`;
  if (g.ly) s += `<text x="4" y="12" font-size="11" fill="#cbd5e1">${esc(g.ly)}</text>`;
  [].concat(g.vl || []).forEach((o: any) =>
    s += `<path d="M${X(o.v)} 0V${H}" stroke="#a5b4fc" stroke-width="2"${o.d ? ' stroke-dasharray="6 4"' : ''}/>`,
  );
  [].concat(g.pl || []).forEach((l: any) =>
    s += `<polyline points="${l.map((p: any) => p[0] + ',' + p[1]).join(' ')}" fill="none" stroke="#f472b6" stroke-width="2.4"/>`,
  );
  [].concat(g.pt || []).forEach((p: any) => s += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3.5" fill="#fbbf24"/>`);
  [].concat(g.ar || []).forEach((r: any) =>
    s += `<path d="M${X(r[0])} ${Y(r[1])}L${X(r[2])} ${Y(r[3])}" stroke="#34d399" stroke-width="2" marker-end="url(#ah)"/><text x="${X(r[2]) + 4}" y="${Y(r[3]) - 4}" font-size="11" fill="#34d399">${esc(r[4] || '')}</text>`,
  );
  return `<svg class="fig" viewBox="0 0 ${W} ${H}"><defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="#34d399"/></marker></defs>${s}</svg>`;
}

export function flow(t: string): string {
  const R = t
    .trim()
    .split('\n')
    .map((l) => l.split('->').map((x) => x.trim()).filter(Boolean))
    .filter((r) => r.length);
  if (!R.length) return '';
  const W = 560,
    gp = 26;
  const n = Math.max(...R.map((r) => r.length));
  const bw = (W - gp * (n - 1)) / n;
  const cpl = Math.max(6, Math.floor(bw / 5.6));
  const wr = (x: string) => {
    const o: string[] = [];
    let c = '';
    x.split(' ').forEach((w) => {
      if (c && (c + ' ' + w).length > cpl) {
        o.push(c);
        c = w;
      } else c = c ? c + ' ' + w : w;
    });
    o.push(c);
    return o;
  };
  const Ls = R.map((r) => r.map(wr));
  const mx = Math.max(...Ls.flat().map((a) => a.length));
  const bh = 14 + 13 * mx;
  const rh = bh + 20;
  let s = '';
  R.forEach((r, j) => {
    const y = j * rh + 4;
    r.forEach((x, i) => {
      const X = i * (bw + gp);
      const L = Ls[j][i];
      const y0 = y + (bh - 13 * L.length) / 2 + 10;
      s +=
        `<rect x="${X}" y="${y}" width="${bw}" height="${bh}" rx="10" fill="#6366f133" stroke="#818cf8"/>` +
        L.map((a: string, k: number) => `<text text-anchor="middle" font-size="10.5" fill="#e6e9f2" x="${X + bw / 2}" y="${y0 + 13 * k}">${esc(a)}</text>`).join('');
      if (i)
        s += `<path d="M${X - gp + 3} ${y + bh / 2}H${X - 3}" stroke="#34d399" stroke-width="2" marker-end="url(#fa)"/>`;
    });
  });
  return `<svg class="fig wide" viewBox="0 0 ${W} ${R.length * rh}"><defs><marker id="fa" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="#34d399"/></marker></defs>${s}</svg>`;
}

/* -------------------------------------------------------------- markdown */

export interface MdHooks {
  quiz?: (json: string) => string;
}

/** Markdown → HTML (subset: headings, lists, tables, bold/italic, math, code, quiz/fig/flow blocks). */
export function md(t: string, hooks: MdHooks = {}): string {
  const Z: string[] = [];
  const F: string[] = [];
  let src = String(t || '');
  src = src.replace(/```quiz\n([\s\S]*?)```/g, (_m, b) => {
    let h = '';
    try {
      h = hooks.quiz ? hooks.quiz(b) : '';
    } catch {
      h = '';
    }
    return '\n\u0002' + (F.push(h) - 1) + '\u0002\n';
  });
  src = src.replace(/```(fig|flow)\n([\s\S]*?)```/g, (_m, k, b) => {
    let h = '';
    try {
      h = k == 'fig' ? fig(JSON.parse(b)) : flow(b);
    } catch {
      h = '';
    }
    return '\n\u0002' + (F.push(`<div class="figbox">${h}</div>`) - 1) + '\u0002\n';
  });
  src = src.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, (m) => '\u0001' + (Z.push(m) - 1) + '\u0001');
  const I = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.+?)\*/g, '<i>$1</i>')
      .replace(/`([^`]+?)`/g, '<code>$1</code>');
  let o = '';
  let L: string | null = null;
  let T = 0;
  const cl = () => {
    if (L) {
      o += '</' + L + '>';
      L = null;
    }
    if (T) {
      o += '</table>';
      T = 0;
    }
  };
  const lines = src.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const l = lines[li];
    let m;
    if (/^\u0002\d+\u0002$/.test(l.trim())) {
      cl();
      o += l.trim();
      continue;
    }
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) {
      cl();
      const h = m[1].length + 1;
      o += `<h${h}>${I(m[2])}</h${h}>`;
    } else if ((m = l.match(/^\s*([-*]|\d+\.)\s+(.*)/))) {
      const k = /\d/.test(m[1]) ? 'ol' : 'ul';
      if (L != k) {
        cl();
        o += '<' + k + '>';
        L = k;
      }
      o += `<li>${I(m[2])}</li>`;
    } else if (/^\s*\|/.test(l)) {
      if (/^[\s|:-]+$/.test(l)) continue;
      if (L) cl();
      const h = !T;
      if (h) {
        o += '<table>';
        T = 1;
      }
      o +=
        '<tr>' +
        l
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((x) => `<${h ? 'th' : 'td'}>${I(x.trim())}</${h ? 'th' : 'td'}>`)
          .join('') +
        '</tr>';
    } else {
      cl();
      if (l.trim()) o += `<p>${I(l)}</p>`;
    }
  }
  cl();
  return o.replace(/\u0001(\d+)\u0001/g, (_m, i) => esc(Z[+i])).replace(/\u0002(\d+)\u0002/g, (_m, i) => F[+i]);
}

/** Render KaTeX inside a container that was filled with md() output. */
export function renderMath(root: HTMLElement | null) {
  if (!root) return;
  try {
    renderMathInElement(root, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
      ],
      throwOnError: false,
      trust: false,
    });
  } catch {
    /* ignore */
  }
}
