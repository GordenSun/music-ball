import { SONGS } from './songs.js';

export const G = 28;
export const R = 0.3;
export const ZB = 1.0;

const GR = G * 5 / 7;
const ENTRY = [3.2, -6.5];
const D1 = 0.4;
const D2 = 0.5;

export const PROPS = {
  duck: { kind: 'duck', rad: 0.5, smin: 0.7 },
  tile: { kind: 'flat', rad: 0.52, smin: 0.5 },
  horn: { kind: 'round', rad: 0.45, smin: 0.6 },
  step: { kind: 'flat', rad: 0.6, smin: 0.3 },
  gem: { kind: 'box', rad: 0.4, smin: 0.65 },
  edge: { kind: 'flat', rad: 0.5, smin: 0.35 },
  cube: { kind: 'box', rad: 0.3, smin: 0.7 },
  bar: { kind: 'flat', rad: 0.55, smin: 0.4 },
};

const STYLES = {
  duck: { u: 3.7, k: 1.6, dropFlip: 0.62, dropRun: 0.3, dxMin: 1.3, dxMax: 2.3, flipDur: 0.3, maxRun: 1, W: 2.6 },
  tile: { u: 4.0, k: 1.7, dropFlip: 0.62, dropRun: 0.3, dxMin: 1.3, dxMax: 2.4, flipDur: 0.3, maxRun: 2, W: 2.8 },
  horn: { u: 4.0, k: 1.5, dropFlip: 0.5, dropRun: 0.22, dxMin: 0.8, dxMax: 2.2, flipDur: 0.5, maxRun: 5, W: 3.2 },
  step: { u: 3.4, k: 0.9, dropFlip: 0.6, dropRun: 0.12, dxMin: 0.5, dxMax: 2.0, flipDur: 99, maxRun: 99, W: 99 },
  gem: { u: 3.6, k: 1.7, dropFlip: 0.62, dropRun: 0.3, dxMin: 1.2, dxMax: 2.2, flipDur: 0.25, maxRun: 1, W: 2.6 },
  edge: { u: 3.8, k: 1.2, dropFlip: 0.6, dropRun: 0.12, dxMin: 0.5, dxMax: 2.2, flipDur: 0.4, maxRun: 8, W: 4 },
  cube: { u: 3.6, k: 1.3, dropFlip: 0.6, dropRun: 0.15, dxMin: 0.68, dxMax: 1.8, flipDur: 0.3, maxRun: 4, W: 3.2 },
  bar: { u: 3.2, k: 1.0, dropFlip: 0.6, dropRun: 0.14, dxMin: 0.8, dxMax: 3.2, flipDur: 0.5, maxRun: 6, W: 4 },
};

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function distSeg(x, y, s) {
  const dx = s[2] - s[0], dy = s[3] - s[1];
  const u = clamp(((x - s[0]) * dx + (y - s[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - s[0] - dx * u, y - s[1] - dy * u);
}

function surfDist(o, x, y) {
  return o.seg ? distSeg(x, y, o.seg) - 0.05 : Math.hypot(x - o.x, y - o.y) - o.r;
}

function makeRail(E, ve, d, rnd, t0, idx) {
  const sp = Math.hypot(ve[0], ve[1]);
  const te = [ve[0] / sp, ve[1] / sp];
  const phi = (34 + rnd() * 10) * Math.PI / 180;
  const lip = [d * Math.cos(phi), Math.sin(phi)];
  let way;
  if (idx % 3 === 1) {
    const L = 6.4 + rnd() * 0.8;
    way = [
      { p: E, dir: te },
      { p: [E[0] + d * L * 0.3, E[1] - 1.9 - rnd() * 0.2], dir: [d, 0] },
      { p: [E[0] + d * L * 0.6, E[1] - 1.4 - rnd() * 0.15], dir: [d, 0] },
      { p: [E[0] + d * L, E[1] - 2.2 - rnd() * 0.3], dir: lip },
    ];
  } else {
    const L = 4.2 + rnd() * 0.9;
    way = [{ p: E, dir: te }, { p: [E[0] + d * L, E[1] - 0.8 - rnd() * 0.4], dir: lip }];
  }
  const pts = [];
  const NS = 30;
  for (let w = 0; w < way.length - 1; w++) {
    const a = way[w], b = way[w + 1];
    const m = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]);
    for (let j = w ? 1 : 0; j <= NS; j++) {
      const s = j / NS, s2 = s * s, s3 = s2 * s;
      const h0 = 2 * s3 - 3 * s2 + 1, h1 = s3 - 2 * s2 + s, h2 = -2 * s3 + 3 * s2, h3 = s3 - s2;
      pts.push({
        x: h0 * a.p[0] + h1 * m * a.dir[0] + h2 * b.p[0] + h3 * m * b.dir[0],
        y: h0 * a.p[1] + h1 * m * a.dir[1] + h2 * b.p[1] + h3 * m * b.dir[1],
      });
    }
  }
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y;
    const l = Math.hypot(tx, ty);
    tx /= l; ty /= l;
    if (i === 0) { tx = te[0]; ty = te[1]; }
    if (i === n - 1) { tx = lip[0]; ty = lip[1]; }
    const q = pts[i];
    q.tx = tx; q.ty = ty; q.nx = d * ty; q.ny = -d * tx;
    q.v = Math.sqrt(Math.max(sp * sp + 2 * GR * (E[1] - q.y), 6));
    if (i === 0) { q.s = 0; q.t = t0; } else {
      const p = pts[i - 1], ds = Math.hypot(q.x - p.x, q.y - p.y);
      q.s = p.s + ds; q.t = p.t + ds / ((p.v + q.v) / 2);
    }
  }
  const e = pts[n - 1];
  return {
    idx, d, pts, t0, t1: e.t, len: e.s,
    exitPos: [e.x, e.y], exitVel: [e.v * lip[0], e.v * lip[1]],
  };
}

function railAt(rail, t) {
  const pts = rail.pts;
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].t <= t) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi], f = clamp((t - a.t) / (b.t - a.t || 1), 0, 1);
  return [a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f];
}

function setGeom(h) {
  const sh = PROPS[h.prop], s = h.s, tx = h.ny, ty = -h.nx;
  const o = { id: h.id };
  if (sh.kind === 'flat') {
    const hw = sh.rad * s, off = h.off * hw;
    o.x = h.x - h.nx * (R + 0.05) + tx * off;
    o.y = h.y - h.ny * (R + 0.05) + ty * off;
    o.r = hw;
    o.seg = [o.x - tx * hw, o.y - ty * hw, o.x + tx * hw, o.y + ty * hw];
  } else if (sh.kind === 'box') {
    const hw = sh.rad * s, off = h.off * hw;
    o.x = h.x - h.nx * (R + hw) + tx * off;
    o.y = h.y - h.ny * (R + hw) + ty * off;
    o.r = hw * 1.2;
  } else if (sh.kind === 'round') {
    o.x = h.x - h.nx * (R + sh.rad * s);
    o.y = h.y - h.ny * (R + sh.rad * s);
    o.r = sh.rad * s;
  } else {
    o.x = h.x - h.nx * (R + 0.25 * s);
    o.y = h.y - h.ny * (R + 0.25 * s) - 0.28 * s;
    o.r = 0.5 * s;
  }
  h.cx = o.x; h.cy = o.y; h.cr = o.r;
  return o;
}

function proxy(id, pos, sh, s) {
  const o = { id, x: pos[0], y: pos[1] - R - 0.05, r: sh.rad * s };
  if (sh.kind === 'flat') o.seg = [o.x - o.r, o.y, o.x + o.r, o.y];
  else if (sh.kind === 'box') { o.y = pos[1] - R - o.r; o.r *= 1.2; }
  else if (sh.kind === 'duck') o.y = pos[1] - R - 0.53 * s;
  else o.y = pos[1] - R - o.r;
  return o;
}

function generate(seed, d0) {
  let rnd = mulberry32(seed);
  const S = SONGS.length;
  const hits = [], segs = [], rails = [], secs = [], obst = [], smp = [];
  let soft = 0, t = 0, pos = [0, 0], d = d0;

  const addFlight = (t0, dt, p, v, a, b) => {
    segs.push({ kind: 0, t0, t1: t0 + dt, x: p[0], y: p[1], vx: v[0], vy: v[1] });
    for (let j = 1; j <= 9; j++) {
      const s = dt * j / 10;
      smp.push({ x: p[0] + v[0] * s, y: p[1] + v[1] * s - 0.5 * G * s * s, a, b });
    }
  };
  const pathHits = (p, v, dt, a) => {
    let c = 0;
    const q0 = Math.max(0, obst.length - 120);
    for (let j = 1; j <= 9; j++) {
      const s = dt * j / 10, x = p[0] + v[0] * s, y = p[1] + v[1] * s - 0.5 * G * s * s;
      for (let q = obst.length - 1; q >= q0; q--) {
        const o = obst[q];
        if (o.id !== a && surfDist(o, x, y) < R * 0.95) { c++; break; }
      }
    }
    return c;
  };
  const spotHits = (o, a) => {
    let c = 0;
    const q0 = Math.max(0, obst.length - 120), s0 = Math.max(0, smp.length - 1200);
    for (let q = obst.length - 1; q >= q0; q--) {
      const b = obst[q];
      if (b.id !== a && Math.hypot(o.x - b.x, o.y - b.y) < (o.r + b.r) * 0.95 + 0.04) c++;
    }
    for (let q = smp.length - 1; q >= s0; q--) {
      if (surfDist(o, smp[q].x, smp[q].y) < R * 0.95) { c++; break; }
    }
    return c;
  };
  const sizeFor = (sh, dist) => clamp((dist - 0.07) / (2 * sh.rad), sh.smin, 1);

  const genSection = (k) => {
    let bad = 0;
    const song = SONGS[k], P = STYLES[song.prop], sh = PROPS[song.prop];
    const rid = -2 - k;
    const rail = makeRail(pos, [d * ENTRY[0], ENTRY[1]], d, rnd, t, k);
    rails.push(rail);
    segs.push({ kind: 1, t0: rail.t0, t1: rail.t1, rail });
    rail.pts.forEach((q, j) => {
      if (j % 3) return;
      obst.push({ id: rid, x: q.x + q.nx * 0.3, y: q.y + q.ny * 0.3, r: 0.1 });
      smp.push({ x: q.x, y: q.y, a: rid, b: rid });
    });
    t = rail.t1;
    addFlight(t, D2, rail.exitPos, rail.exitVel, rid, hits.length);
    pos = [rail.exitPos[0] + rail.exitVel[0] * D2, rail.exitPos[1] + rail.exitVel[1] * D2 - 0.5 * G * D2 * D2];
    let vin = [rail.exitVel[0], rail.exitVel[1] - G * D2];
    t += D2;
    const sec = { k, name: song.name, prop: song.prop, inst: song.inst, tRail: rail.t0, tFirst: t, first: hits.length, d };
    const xc = pos[0] - d * P.W * 0.4;
    let run = 1, prevDur = D2, dPrev = 9;
    obst.push(proxy(hits.length, pos, sh, 1));
    bad += spotHits(obst[obst.length - 1], hits.length) ? 1 : 0;

    for (let i = 0; i < song.notes.length; i++) {
      const note = song.notes[i], id = hits.length, last = i === song.notes.length - 1;
      const dirIn = Math.sign(vin[0]) || d;
      let best = null;
      const consider = (c) => {
        const ax = c.vx - vin[0], ay = c.vy - vin[1], al = Math.hypot(ax, ay) || 1;
        c.nx = ax / al; c.ny = ay / al;
        if (c.ny < 0.3) c.cost += 500;
        if (c.vx * c.nx + c.vy * c.ny < 0.4) c.cost += 500;
        if (c.cost < 1000 && (!best || c.cost < best.cost)) {
          c.cost += 1000 * pathHits(pos, [c.vx, c.vy], c.dt, id);
          if (c.spot) c.cost += 1000 * c.spot();
        }
        if (!best || c.cost < best.cost) best = c;
      };
      if (!last) {
        const dt = note.dur;
        let pd = (prevDur >= P.flipDur || run >= P.maxRun) ? -dirIn : dirIn;
        if (pos[0] - xc > P.W) pd = -1; else if (pos[0] - xc < -P.W) pd = 1;
        const jit = 0.92 + rnd() * 0.3;
        search:
        for (const dd of [pd, -pd]) {
          const flip = dd !== dirIn;
          for (let di = 0; di < 4; di++) {
            for (let xi = 0; xi < 3; xi++) {
              const dx = clamp(P.u * dt, P.dxMin, P.dxMax) * [1, 1.25, 0.8][xi] * (flip ? jit : 1);
              let drop = Math.max(P.k * dt, flip ? P.dropFlip : P.dropRun) * [1, 1.5, 2.2, 3.2][di];
              if (!flip) drop = Math.min(drop, 0.7 * 0.5 * G * dt * dt);
              const vx = dd * dx / dt, vy = (-drop + 0.5 * G * dt * dt) / dt;
              const dist = Math.hypot(dx, drop);
              const np = proxy(id + 1, [pos[0] + dd * dx, pos[1] - drop], sh, sizeFor(sh, dist));
              consider({
                dt, vx, vy, dd, flip, dist, np,
                cost: (dd !== pd ? 40 : 0) + di * 4 + xi,
                spot: () => spotHits(np, id),
              });
              if (best.cost === 0) break search;
            }
          }
        }
      } else {
        const pref = pos[0] > 2 ? -1 : pos[0] < -2 ? 1 : dirIn;
        for (const dn of k === S - 1 ? [d0] : [pref, -pref]) {
          for (const [ci, dt] of [D1, 0.34].entries()) {
            const vx = dn * ENTRY[0], vy = G * dt + ENTRY[1];
            const ex = pos[0] + vx * dt, ey = pos[1] + vy * dt - 0.5 * G * dt * dt;
            consider({
              dt, vx, vy, dd: dn,
              cost: (dn !== pref ? 10 : 0) + ci * 3,
              spot: () => {
                let c = 0;
                const probe = makeRail([ex, ey], [vx, vy - G * dt], dn, () => 0.5, 0, k + 1);
                probe.pts.forEach((q, j) => {
                  if (j % 2 === 0) c += spotHits({ x: q.x + q.nx * 0.15, y: q.y + q.ny * 0.15, r: 0.5 }, id) ? 1 : 0;
                });
                return c;
              },
            });
          }
        }
      }
      if (best.cost >= 500) bad++;
      const h = {
        id, t, x: pos[0], y: pos[1], vin, vout: [best.vx, best.vy], nx: best.nx, ny: best.ny,
        song: k, i, midi: note.midi, dur: note.dur, prop: song.prop,
        off: (rnd() - 0.5) * 0.5, s: sizeFor(sh, Math.min(dPrev, last ? 9 : best.dist)), r1: rnd(), r2: rnd(),
      };
      hits.push(h);
      obst[obst.length - 1] = setGeom(h);
      addFlight(t, best.dt, pos, h.vout, id, last ? -3 - k : id + 1);
      pos = [pos[0] + best.vx * best.dt, pos[1] + best.vy * best.dt - 0.5 * G * best.dt * best.dt];
      vin = [best.vx, best.vy - G * best.dt];
      t += best.dt;
      if (!last) {
        run = best.flip ? 1 : run + 1;
        prevDur = note.dur;
        dPrev = best.dist;
        obst.push(best.np);
      } else d = best.dd;
    }
    sec.last = hits.length - 1;
    sec.tLast = hits[sec.last].t;
    secs.push(sec);
    return bad;
  };

  for (let k = 0; k < S; k++) {
    const snap = [hits.length, segs.length, rails.length, secs.length, obst.length, smp.length, t, pos, d];
    const attempt = (a) => {
      [hits.length, segs.length, rails.length, secs.length, obst.length, smp.length, t, pos, d] = snap;
      rnd = mulberry32(seed * 131 + k * 17 + a * 7919);
      return genSection(k);
    };
    let bestA = 0, bestBad = 1e9, bad = 0;
    for (let a = 0; a < 12; a++) {
      bad = attempt(a);
      if (bad < bestBad) { bestBad = bad; bestA = a; }
      if (!bad) break;
    }
    if (bad !== bestBad) bad = attempt(bestA);
    soft += bad;
  }

  for (const sec of secs) {
    const sh = PROPS[sec.prop];
    for (let i = sec.first; i <= sec.last; i++) {
      let nn = 1e9;
      for (let j = sec.first; j <= sec.last; j++) {
        if (j !== i) nn = Math.min(nn, Math.hypot(hits[i].cx - hits[j].cx, hits[i].cy - hits[j].cy));
      }
      hits[i].s = Math.min(hits[i].s, clamp((nn - 0.07) / (2 * sh.rad), sh.smin, 1));
    }
  }
  const finalObst = obst.filter(o => o.id < 0);
  for (const h of hits) finalObst.push(setGeom(h));
  let pen = 0;
  for (const s of smp) {
    for (const o of finalObst) {
      if (o.id === s.a || o.id === s.b) continue;
      if (Math.abs(o.y - s.y) > 2 || Math.abs(o.x - s.x) > 2) continue;
      if (surfDist(o, s.x, s.y) < R * 0.9) { pen++; break; }
    }
  }
  return { seed, d0, T: t, D: pos, hits, segs, rails, secs, obst: finalObst, smp, soft, pen, violations: soft + pen };
}

function finalize(lv) {
  const { T, D, segs } = lv;
  const posRaw = (tau) => {
    let lo = 0, hi = segs.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segs[m].t0 <= tau) lo = m; else hi = m - 1; }
    const s = segs[lo];
    if (s.kind === 1) return railAt(s.rail, tau);
    const dt = tau - s.t0;
    return [s.x + s.vx * dt, s.y + s.vy * dt - 0.5 * G * dt * dt];
  };
  const posWrap = (tau) => {
    const c = Math.floor(tau / T), p = posRaw(tau - c * T);
    return [p[0] + c * D[0], p[1] + c * D[1]];
  };
  lv.posAt = posWrap;

  const N = Math.ceil(T * 240), h = T / N;
  const spin = new Float64Array(N + 1);
  let prev = posRaw(0);
  for (let i = 1; i <= N; i++) {
    const p = i === N ? [D[0], D[1]] : posRaw(i * h);
    spin[i] = spin[i - 1] - (p[0] - prev[0]) / R;
    prev = p;
  }
  const corr = Math.round(spin[N] / (2 * Math.PI)) * 2 * Math.PI - spin[N];
  lv.spinAt = (tau) => {
    const c = Math.floor(tau / T), f = (tau - c * T) / h, i = Math.min(N - 1, Math.floor(f));
    return spin[i] + (spin[i + 1] - spin[i]) * (f - i) + corr * (tau - c * T) / T;
  };

  const M = Math.ceil(T * 60), hc = T / M, sig = 0.3, lead = 0.1, W = 36, step = 1 / 40;
  const cam = new Float64Array((M + 1) * 2);
  for (let m = 0; m < M; m++) {
    let sx = 0, sy = 0, sw = 0;
    for (let j = -W; j <= W; j++) {
      const o = j * step, w = Math.exp(-o * o / (2 * sig * sig)), p = posWrap(m * hc + lead + o);
      sx += p[0] * w; sy += p[1] * w; sw += w;
    }
    cam[m * 2] = sx / sw; cam[m * 2 + 1] = sy / sw;
  }
  cam[M * 2] = cam[0] + D[0]; cam[M * 2 + 1] = cam[1] + D[1];
  lv.camAt = (tau) => {
    const c = Math.floor(tau / T), f = (tau - c * T) / hc, i = Math.min(M - 1, Math.floor(f)), u = f - i;
    return [
      cam[i * 2] + (cam[i * 2 + 2] - cam[i * 2]) * u + c * D[0],
      cam[i * 2 + 1] + (cam[i * 2 + 3] - cam[i * 2 + 1]) * u + c * D[1],
    ];
  };

  lv.events = [];
  for (const hit of lv.hits) {
    lv.events.push({
      t: hit.t, type: 'note', inst: SONGS[hit.song].inst, midi: hit.midi, dur: hit.dur,
      vel: hit.dur >= 0.35 ? 1 : 0.84,
    });
  }
  for (const r of lv.rails) lv.events.push({ t: r.t0, type: 'roll', dur: r.t1 - r.t0 });
  lv.events.sort((a, b) => a.t - b.t);

  placeDecals(lv);
}

function placeDecals(lv) {
  const { T, D, secs, rails } = lv;
  const blockers = [];
  for (const c of [-1, 0, 1]) {
    for (const o of lv.obst) blockers.push([o.x + c * D[0], o.y + c * D[1], o.r]);
    for (const s of lv.smp) blockers.push([s.x + c * D[0], s.y + c * D[1], R]);
  }
  const decals = [];
  const clearance = (x, y, hw, hh) => {
    let best = 1e9;
    for (const b of blockers) {
      if (Math.abs(b[1] - y) > 4 || Math.abs(b[0] - x) > hw + 4) continue;
      const dx = Math.max(0, Math.abs(b[0] - x) - hw), dy = Math.max(0, Math.abs(b[1] - y) - hh);
      best = Math.min(best, Math.hypot(dx, dy) - b[2]);
    }
    for (const dc of decals) {
      for (const c of [-1, 0, 1]) {
        if (Math.abs(dc.y + c * D[1] - y) < 2.2 && Math.abs(dc.x + c * D[0] - x) < dc.hw + hw + 1.2) best = Math.min(best, 0);
      }
    }
    return best;
  };
  const put = (text, size, ax, ay, sec, rot, xr = 2.5, yr = 2, cap = 0.9) => {
    const hw = size * 0.5 * Math.max(2, [...text].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 1 : 0.55), 0));
    let best = null;
    for (let gy = -yr; gy <= yr; gy += 0.4) {
      for (let gx = -xr; gx <= xr; gx += 0.5) {
        const x = ax + gx, y = ay + gy;
        const score = Math.min(clearance(x, y, hw, size * 0.5), cap) - 0.12 * Math.hypot(gx, gy);
        if (!best || score > best.score) best = { score, x, y };
      }
    }
    const dc = { text, size, x: best.x, y: best.y, hw, sec, rot };
    decals.push(dc);
    blockers.push([dc.x, dc.y, hw * 0.6]);
    return dc;
  };

  const r0 = rails[0], c0 = lv.camAt(0);
  const title = put('猜猜是哪 8 首歌？', 0.5, c0[0] + r0.d * 0.2, c0[1] + 2.0, 0, -0.04 * r0.d, 0.6, 1.2, 1.7);
  put('@大肥鱼', 0.34, title.x - r0.d * 0.8, title.y + 0.85, 0, -0.04 * r0.d, 1.5, 0.8);
  const texts = ['点赞 · 关注', '@大肥鱼', '你猜对了几首？', '评论区见'];
  let n = 0;
  for (const sec of secs) {
    const times = [sec.tFirst + (sec.tLast - sec.tFirst) * 0.3, sec.tFirst + (sec.tLast - sec.tFirst) * 0.85];
    if (sec.k > 0) times.unshift(sec.tRail + 0.25);
    for (const tm of times) {
      const c = lv.camAt(tm), side = n % 2 ? 1 : -1, rot = (lv.hits[n * 7 % lv.hits.length].r1 - 0.5) * 0.3;
      if (sec.k === 0 && tm === times[0]) put('猜猜是哪 8 首歌？', 0.4, c[0] + side * 1.6, c[1] - 0.4, 0, rot);
      else put(texts[n % texts.length], n % texts.length === 1 ? 0.34 : 0.42, c[0] + side * 1.9, c[1] - 0.4, sec.k, rot);
      n++;
    }
  }
  lv.decals = decals;
}

export function buildLevel(seed = 1) {
  let best = null;
  for (let a = 0; a < 60; a++) {
    const lv = generate(seed + a * 1000, (seed + a) % 2 ? 1 : -1);
    if (!best || lv.violations < best.violations) best = lv;
    if (best.violations === 0) break;
  }
  finalize(best);
  return best;
}

export { generate as _generate };
