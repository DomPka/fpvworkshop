/*
 * Lenktynių trasos animacija: FPV „whoop'ai“ skrenda pro LED žiedų vartus.
 * Maža 3D scena ant <canvas>: trasa – uždara Catmull-Rom kreivė, vartai stovi statmenai
 * jai, o kamera rodo trasą iš šono arba piloto (FPV) akimis su OSD užrašais.
 */
(() => {
  'use strict';

  const canvas = document.querySelector('[data-race]');
  const stage = document.querySelector('[data-race-stage]');
  if (!canvas || !stage || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Vektoriai ---------- */

  const vec = (x, y, z) => ({ x, y, z });
  const add = (a, b) => vec(a.x + b.x, a.y + b.y, a.z + b.z);
  const sub = (a, b) => vec(a.x - b.x, a.y - b.y, a.z - b.z);
  const mul = (a, k) => vec(a.x * k, a.y * k, a.z * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a, b) => vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  const norm = (a) => {
    const l = Math.hypot(a.x, a.y, a.z) || 1;
    return vec(a.x / l, a.y / l, a.z / l);
  };
  const flat = (a) => vec(a.x, 0, a.z);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const UP = vec(0, 1, 0);

  /* ---------- Trasa ---------- */

  // Kontroliniai taškai: x, skrydžio aukštis y, z (metrais).
  const control = [
    vec(-10, 1.1, -4), vec(-4, 1.3, -6.5), vec(4, 1.5, -6.5), vec(10.5, 1.3, -3.5),
    vec(11, 1.1, 3), vec(6, 1.4, 6.5), vec(0, 2.3, 3.2), vec(-6, 1.4, 6.5), vec(-11, 1.1, 3),
  ];
  const SEG = 80;
  const pts = [];
  for (let i = 0; i < control.length; i++) {
    const p0 = control[(i - 1 + control.length) % control.length];
    const p1 = control[i];
    const p2 = control[(i + 1) % control.length];
    const p3 = control[(i + 2) % control.length];
    for (let j = 0; j < SEG; j++) {
      const t = j / SEG;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push(vec(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z)));
    }
  }
  const cum = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i % pts.length];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  const LENGTH = cum[pts.length];

  // Taškas ir kryptis trasoje pagal nuotolį s.
  function at(s) {
    s = ((s % LENGTH) + LENGTH) % LENGTH;
    let lo = 0;
    let hi = pts.length;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const a = pts[lo];
    const b = pts[(lo + 1) % pts.length];
    const k = (s - cum[lo]) / (cum[lo + 1] - cum[lo] || 1);
    return { p: add(a, mul(sub(b, a), k)), t: norm(sub(b, a)) };
  }

  const sAtControl = (k) => cum[Math.round(k * SEG) % pts.length];

  function frameAt(s) {
    const { p, t } = at(s);
    const forward = norm(flat(t));
    return { p, t, forward, right: norm(cross(forward, UP)) };
  }

  // Vartai – kaip tikroje AGAI trasoje: LED žiedai, kvadratiniai vartai ir „kopėčios“.
  const gates = [
    { k: 0.55, type: 'ring', color: '#30d5c8', r: 0.8 },
    { k: 1.55, type: 'square', color: '#0a84ff' },
    { k: 2.6, type: 'ring', color: '#ff375f', r: 0.75 },
    { k: 3.55, type: 'ring', color: '#30d5c8', r: 1 },
    { k: 4.6, type: 'square', color: '#bf5af2' },
    { k: 6, type: 'ladder', colors: ['#0a84ff', '#ff375f', '#30d5c8'] },
    { k: 7.5, type: 'ring', color: '#ff9f0a', r: 0.8 },
    { k: 8.45, type: 'square', color: '#30d158' },
  ].map((g) => {
    const s = sAtControl(g.k);
    return Object.assign({ s, flash: 0 }, g, frameAt(s));
  });

  const center = vec(0, 0, 0);
  const flags = [1, 3.1, 5, 7.9].map((k, i) => {
    const { p, forward } = frameAt(sAtControl(k));
    const out = norm(flat(sub(p, center)));
    return { base: add(flat(p), mul(out, 2.1)), dir: forward, color: i % 2 ? '#bf5af2' : '#0a84ff' };
  });

  const floorStrip = [];
  for (let i = 0; i < pts.length; i += 4) floorStrip.push(flat(pts[i]));

  const grid = [];
  for (let x = -30; x <= 30; x += 2) grid.push([vec(x, 0, -30), vec(x, 0, 30)]);
  for (let z = -30; z <= 30; z += 2) grid.push([vec(-30, 0, z), vec(30, 0, z)]);
  const floorQuad = [vec(-60, 0, -60), vec(60, 0, -60), vec(60, 0, 60), vec(-60, 0, 60)];

  /* ---------- Lenktynininkai ---------- */

  const SPEED = 7.4;
  const racers = [
    { color: '#0a84ff', amp: 1.6, freq: 0.55, phase: 0, lane: 0, s0: -7.2 },
    { color: '#ff375f', amp: 2, freq: 0.47, phase: 2.1, lane: 0.25, s0: 0 },
    { color: '#30d158', amp: 1.4, freq: 0.61, phase: 4, lane: -0.25, s0: -2.4 },
    { color: '#ff9f0a', amp: 1.8, freq: 0.4, phase: 1.1, lane: 0.12, s0: -4.8 },
  ].map((r) => Object.assign({ s: 0, prevS: 0, trail: [], bank: 0, pos: vec(0, 0, 0), fwd: vec(1, 0, 0), right: vec(0, 0, 1) }, r));

  function updateRacers(time, dt) {
    for (const r of racers) {
      r.prevS = r.s;
      r.s = r.s0 + SPEED * time + r.amp * Math.sin(r.freq * time + r.phase);
      const here = frameAt(r.s);
      const ahead = frameAt(r.s + 0.6);
      // Posūkio kampas → pasvirimas (bank) kaip tikro drono.
      const turn = Math.atan2(cross(here.forward, ahead.forward).y, dot(here.forward, ahead.forward)) / 0.6;
      const bankTarget = clamp(-turn * SPEED * SPEED * 0.035, -0.85, 0.85);
      r.bank += (bankTarget - r.bank) * (dt > 0 ? Math.min(1, dt * 6) : 1);
      r.pos = add(add(here.p, mul(here.right, r.lane)), vec(0, 0.06 * Math.sin(time * 3 + r.phase), 0));
      r.fwd = here.t;
      const side = norm(cross(r.fwd, UP));
      const lift = cross(side, r.fwd);
      r.right = add(mul(side, Math.cos(r.bank)), mul(lift, Math.sin(r.bank)));
      r.trail.push(r.pos);
      if (r.trail.length > 24) r.trail.shift();

      if (dt > 0) {
        for (const g of gates) {
          const lapBase = Math.floor(r.prevS / LENGTH) * LENGTH;
          for (const base of [lapBase, lapBase + LENGTH]) {
            const gs = base + g.s;
            if (r.prevS < gs && r.s >= gs) g.flash = 1;
          }
        }
      }
    }
    for (const g of gates) g.flash = Math.max(0, g.flash - dt * 2.5);
  }

  /* ---------- Kamera ir projekcija ---------- */

  const NEAR = 0.12;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let mode = 'overview';
  let cam = null;

  function makeCamera(pos, forward, roll, vfov, hfov) {
    const f = norm(forward);
    let r = norm(cross(f, UP));
    let u = cross(r, f);
    const c = Math.cos(roll);
    const s = Math.sin(roll);
    const r2 = add(mul(r, c), mul(u, s));
    const u2 = sub(mul(u, c), mul(r, s));
    const focal = Math.min((H / 2) / Math.tan(vfov / 2), (W / 2) / Math.tan(hfov / 2));
    return { pos, f, r: r2, u: u2, focal };
  }

  function toCam(p) {
    const d = sub(p, cam.pos);
    return [dot(d, cam.r), dot(d, cam.u), dot(d, cam.f)];
  }

  function project(c) {
    return [W / 2 + (c[0] / c[2]) * cam.focal, H / 2 - (c[1] / c[2]) * cam.focal];
  }

  function toNear(a, b) {
    const k = (NEAR - a[2]) / (b[2] - a[2]);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, NEAR];
  }

  // Laužtė su nukirpimu ties artimąja plokštuma (reikia FPV vaizdui pro vartus).
  function pathPolyline(points, closed) {
    const n = points.length + (closed ? 1 : 0);
    let prev = null;
    let penDown = false;
    for (let i = 0; i < n; i++) {
      const c = toCam(points[i % points.length]);
      if (prev) {
        if (prev[2] < NEAR && c[2] < NEAR) {
          penDown = false;
        } else {
          let a = prev;
          let b = c;
          let lift = false;
          if (a[2] < NEAR) {
            a = toNear(a, b);
            penDown = false;
          }
          if (b[2] < NEAR) {
            b = toNear(b, a);
            lift = true;
          }
          const pa = project(a);
          const pb = project(b);
          if (!penDown) ctx.moveTo(pa[0], pa[1]);
          ctx.lineTo(pb[0], pb[1]);
          penDown = !lift;
        }
      }
      prev = c;
    }
  }

  // Daugiakampio nukirpimas (Sutherland–Hodgman) ir užpildymas.
  function fillPolygon(points, style) {
    const cs = points.map(toCam);
    const out = [];
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i];
      const b = cs[(i + 1) % cs.length];
      const aIn = a[2] >= NEAR;
      const bIn = b[2] >= NEAR;
      if (aIn) out.push(a);
      if (aIn !== bIn) out.push(toNear(aIn ? b : a, aIn ? a : b));
    }
    if (out.length < 3) return;
    ctx.beginPath();
    out.forEach((c, i) => {
      const p = project(c);
      if (i) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.fillStyle = style;
    ctx.fill();
  }

  function glow(color, width, intensity) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.14 * intensity;
    ctx.lineWidth = width * 5;
    ctx.stroke();
    ctx.globalAlpha = 0.35 * intensity;
    ctx.lineWidth = width * 2.2;
    ctx.stroke();
    ctx.globalAlpha = Math.min(1, 0.9 * intensity);
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  }

  function depthWidth(p, meters, min, max) {
    const d = toCam(p)[2];
    return d < NEAR ? max : clamp((meters * cam.focal) / d, min, max);
  }

  function floorGlow(p, color, radius, alpha) {
    const c = toCam(vec(p.x, 0.01, p.z));
    if (c[2] < NEAR) return;
    const q = project(c);
    const rx = (radius * cam.focal) / c[2];
    const ry = rx * clamp(Math.abs(dot(cam.f, UP)) + 0.12, 0.15, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(q[0], q[1]);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function ringPoints(c, right, radius) {
    const out = [];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      out.push(add(c, add(mul(right, Math.cos(a) * radius), mul(UP, Math.sin(a) * radius))));
    }
    return out;
  }

  function stand(from, to) {
    ctx.beginPath();
    pathPolyline([from, to], false);
    ctx.strokeStyle = '#3a3a3c';
    ctx.lineWidth = depthWidth(from, 0.05, 1, 10);
    ctx.stroke();
  }

  /* ---------- Objektų piešimas ---------- */

  function drawGate(g) {
    const boost = 1 + g.flash * 1.4;
    if (g.type === 'ring') {
      floorGlow(g.p, g.color, 1.6, 0.35 * boost);
      stand(vec(g.p.x, 0, g.p.z), sub(g.p, mul(UP, g.r)));
      ctx.beginPath();
      pathPolyline(ringPoints(g.p, g.right, g.r), true);
      glow(g.color, depthWidth(g.p, 0.07, 1.2, 16), boost);
    } else if (g.type === 'square') {
      const w = 0.85;
      const lo = Math.max(0.25, g.p.y - w);
      const hi = g.p.y + w;
      const c = (dx, y) => add(vec(g.p.x, y, g.p.z), mul(g.right, dx));
      floorGlow(g.p, g.color, 1.8, 0.3 * boost);
      stand(c(-w, 0), c(-w, lo));
      stand(c(w, 0), c(w, lo));
      ctx.beginPath();
      pathPolyline([c(-w, lo), c(w, lo), c(w, hi), c(-w, hi)], true);
      glow(g.color, depthWidth(g.p, 0.08, 1.2, 16), boost);
    } else if (g.type === 'ladder') {
      const r = 0.55;
      const step = 1.2;
      const top = g.p.y + step + r;
      const post = (dx) => [add(vec(g.p.x, 0, g.p.z), mul(g.right, dx)), add(vec(g.p.x, top, g.p.z), mul(g.right, dx))];
      floorGlow(g.p, g.colors[2], 1.8, 0.35 * boost);
      stand(...post(-r - 0.12));
      stand(...post(r + 0.12));
      g.colors.forEach((color, i) => {
        const c = add(g.p, mul(UP, (i - 1) * step));
        ctx.beginPath();
        pathPolyline(ringPoints(c, g.right, r), true);
        glow(color, depthWidth(c, 0.07, 1.2, 16), i === 1 ? boost : 1);
      });
    }
  }

  function drawFlag(f) {
    const top = add(f.base, mul(UP, 2.6));
    stand(f.base, top);
    const along = mul(f.dir, -1);
    const shape = [
      top,
      add(add(f.base, mul(UP, 2.45)), mul(along, 0.6)),
      add(add(f.base, mul(UP, 1.3)), mul(along, 0.55)),
      add(f.base, mul(UP, 1)),
    ];
    fillPolygon(shape, f.color);
  }

  function drawWhoop(r) {
    const c = toCam(r.pos);
    if (c[2] < 0.35) return;
    const S = mode === 'fpv' ? 0.3 : 0.55;
    const o = project(c);
    const ex = project(toCam(add(r.pos, mul(r.fwd, S))));
    const ey = project(toCam(add(r.pos, mul(r.right, S))));
    const ax = ex[0] - o[0];
    const ay = ex[1] - o[1];
    const bx = ey[0] - o[0];
    const by = ey[1] - o[1];
    const size = Math.max(Math.hypot(ax, ay), Math.hypot(bx, by));

    floorGlow(r.pos, r.color, 0.9, 0.35);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(o[0], o[1], 0, o[0], o[1], size * 3.2);
    g.addColorStop(0, r.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(o[0], o[1], size * 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.transform(ax, ay, bx, by, o[0], o[1]);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2c2c2e';
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.moveTo(-0.62, -0.62);
    ctx.lineTo(0.62, 0.62);
    ctx.moveTo(0.62, -0.62);
    ctx.lineTo(-0.62, 0.62);
    ctx.stroke();
    for (const [dx, dy] of [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]]) {
      ctx.beginPath();
      ctx.arc(dx, dy, 0.48, 0, Math.PI * 2);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = r.color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 0.14;
      ctx.strokeStyle = '#1c1c1e';
      ctx.stroke();
    }
    ctx.fillStyle = '#1c1c1e';
    ctx.fillRect(-0.38, -0.28, 0.76, 0.56);
    ctx.fillStyle = r.color;
    ctx.fillRect(-0.18, -0.2, 0.42, 0.4);
    ctx.beginPath();
    ctx.arc(0.34, 0, 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
  }

  function drawTrail(r) {
    if (r.trail.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 1; i < r.trail.length; i++) {
      const k = i / r.trail.length;
      // Šalia kameros esančios uodegos atkarpos FPV vaizde virstų ilgais brūkšniais.
      if (Math.min(toCam(r.trail[i - 1])[2], toCam(r.trail[i])[2]) < 0.8) continue;
      ctx.beginPath();
      pathPolyline([r.trail[i - 1], r.trail[i]], false);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = k * 0.7;
      ctx.lineWidth = depthWidth(r.trail[i], mode === 'fpv' ? 0.07 : 0.14, 0.8, 8) * k;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStartLine() {
    const { p, forward, right } = frameAt(0);
    const base = flat(p);
    const size = 0.3;
    for (let row = 0; row < 2; row++) {
      for (let col = -4; col < 4; col++) {
        const o = add(add(base, mul(right, col * size)), mul(forward, row * size));
        const quad = [o, add(o, mul(right, size)), add(add(o, mul(right, size)), mul(forward, size)), add(o, mul(forward, size))];
        fillPolygon(quad, (row + col) % 2 ? 'rgba(245,245,247,.85)' : 'rgba(10,10,12,.9)');
      }
    }
  }

  /* ---------- Kadras ---------- */

  const pilot = racers[0];
  let time = 0;
  let lap = 1;
  let lapStart = 0;

  let look = null;

  function setCamera(dt) {
    if (mode === 'fpv') {
      const eye = add(pilot.pos, vec(0, 0.08, 0));
      const ahead = frameAt(pilot.s + 3.2);
      const target = add(norm(sub(add(ahead.p, mul(ahead.right, pilot.lane)), eye)), vec(0, 0.03, 0));
      look = look && dt ? norm(add(look, mul(sub(target, look), Math.min(1, dt * 7)))) : target;
      cam = makeCamera(eye, look, -pilot.bank * 0.55, 1.45, 1.9);
    } else {
      look = null;
      const narrow = W / H < 1;
      // Siaurame ekrane ilgoji trasos ašis nukreipiama į gylį, kad trasa užpildytų kadrą.
      const angle = (narrow ? 1.57 : 0.5) + Math.sin(time * 0.06) * (narrow ? 0.2 : 0.35);
      const dist = narrow ? 15 : 19;
      const eye = vec(Math.sin(angle) * dist, narrow ? 15 : 12.5, -Math.cos(angle) * dist);
      cam = makeCamera(eye, sub(vec(0, 0.5, 0), eye), 0, narrow ? 1.05 : 0.8, narrow ? 1.25 : 1.35);
    }
  }

  function drawOSD() {
    const fs = clamp(W / 46, 11, 17);
    ctx.save();
    ctx.font = `700 ${fs}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.85)';
    ctx.fillStyle = '#fff';
    const pad = fs * 1.4;
    const text = (str, x, y, align) => {
      ctx.textAlign = align;
      ctx.strokeText(str, x, y);
      ctx.fillText(str, x, y);
    };
    const lapTime = time - lapStart;
    const mm = String(Math.floor(lapTime / 60)).padStart(2, '0');
    const ss = (lapTime % 60).toFixed(1).padStart(4, '0');
    const volts = (4.2 - ((time * 0.01) % 0.6)).toFixed(2);
    text('ACRO', pad, pad + fs, 'left');
    text(volts + 'V', pad, pad + fs * 2.3, 'left');
    text(`${mm}:${ss}`, W - pad, pad + fs, 'right');
    text('R7 5880', pad, H - pad, 'left');
    text(`RATAS ${lap}`, W - pad, H - pad, 'right');
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 2;
    const cx = W / 2;
    const cy = H / 2;
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy);
    ctx.lineTo(cx - 6, cy);
    ctx.moveTo(cx + 6, cy);
    ctx.lineTo(cx + 18, cy);
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx, cy - 12);
    ctx.stroke();
    ctx.restore();
  }

  function render(dt) {
    setCamera(dt || 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#04060d');
    sky.addColorStop(1, '#0b1226');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    fillPolygon(floorQuad, '#070b17');
    ctx.beginPath();
    grid.forEach(([a, b]) => pathPolyline([a, b], false));
    ctx.strokeStyle = 'rgba(120,150,255,.09)';
    ctx.lineWidth = 1;
    ctx.stroke();

    drawStartLine();
    ctx.beginPath();
    pathPolyline(floorStrip, true);
    glow('#ff2d95', mode === 'fpv' ? 2.4 : 1.6, 0.9);

    racers.forEach(drawTrail);

    const items = [];
    gates.forEach((g) => items.push({ d: toCam(g.p)[2], draw: () => drawGate(g) }));
    flags.forEach((f) => items.push({ d: toCam(f.base)[2], draw: () => drawFlag(f) }));
    racers.forEach((r) => {
      if (mode === 'fpv' && r === pilot) return;
      items.push({ d: toCam(r.pos)[2], draw: () => drawWhoop(r) });
    });
    items.sort((a, b) => b.d - a.d).forEach((item) => {
      if (item.d > -2) item.draw();
    });

    if (mode === 'fpv') drawOSD();
  }

  function step(dt) {
    time += dt;
    updateRacers(time, dt);
    const currentLap = Math.floor(pilot.s / LENGTH) + 1;
    if (currentLap !== lap) {
      lap = currentLap;
      lapStart = time;
    }
  }

  /* ---------- Ciklas, dydis ir valdymas ---------- */

  let running = false;
  let visible = false;
  let last = 0;

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    render(dt);
    requestAnimationFrame(frame);
  }

  function sync() {
    const shouldRun = visible && !document.hidden && !reduceMotion.matches;
    if (shouldRun && !running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    } else if (!shouldRun) {
      running = false;
    }
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    render();
  }

  document.querySelectorAll('[data-race-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.getAttribute('data-race-mode');
      document.querySelectorAll('[data-race-mode]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === button));
      });
      stage.classList.toggle('is-fpv', mode === 'fpv');
      render();
    });
  });

  // Pradinė būsena: lenktynininkai jau trasoje (svarbu ir sustabdžius judesį).
  time = 4;
  updateRacers(time, 0);
  lap = Math.floor(pilot.s / LENGTH) + 1;
  lapStart = time - ((pilot.s % LENGTH) + LENGTH) % LENGTH / SPEED;

  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }).observe(stage);
  document.addEventListener('visibilitychange', sync);
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', sync);
})();
