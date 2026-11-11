// Dumps the generated level as an SVG (and PNG via Chrome) to eyeball trajectories and collisions.
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { buildLevel, R } from '../js/level.js';

const seed = +(process.argv[2] || 1);
const out = process.argv[3] || '/tmp/ballref/layout';
const t0 = performance.now();
const lv = buildLevel(seed);
console.log(`seed ${seed} -> gen seed ${lv.seed} d0 ${lv.d0} T=${lv.T.toFixed(2)}s D=[${lv.D.map(v => v.toFixed(1))}] hits=${lv.hits.length} violations=${lv.violations} (soft ${lv.soft} pen ${lv.pen}) (${(performance.now() - t0).toFixed(0)}ms)`);
for (const s of lv.secs) {
  const hs = lv.hits.slice(s.first, s.last + 1);
  const xs = hs.map(h => h.x), ys = hs.map(h => h.y);
  console.log(`  ${s.k} ${s.name} rail@${s.tRail.toFixed(2)} notes ${s.tFirst.toFixed(2)}-${s.tLast.toFixed(2)} x[${Math.min(...xs).toFixed(1)},${Math.max(...xs).toFixed(1)}] y[${Math.min(...ys).toFixed(1)},${Math.max(...ys).toFixed(1)}] scale[${Math.min(...hs.map(h => h.s)).toFixed(2)},${Math.max(...hs.map(h => h.s)).toFixed(2)}] maxTilt=${Math.max(...hs.map(h => Math.acos(h.ny) * 57.3)).toFixed(0)}`);
}

let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
for (const s of lv.smp) { minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y); }
minX -= 4; maxX += 4; minY -= 3; maxY += 4;
const only = process.argv[4];
if (only !== undefined) {
  const sec = lv.secs[+only], hs = lv.hits.slice(sec.first, sec.last + 1);
  minX = Math.min(...hs.map(h => h.x)) - 7; maxX = Math.max(...hs.map(h => h.x)) + 7;
  minY = Math.min(...hs.map(h => h.y)) - 3; maxY = Math.max(...hs.map(h => h.y)) + 3;
}
const S = only !== undefined ? 60 : 22, X = x => ((x - minX) * S).toFixed(1), Y = y => ((maxY - y) * S).toFixed(1);
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${(maxX - minX) * S}" height="${(maxY - minY) * S}" style="background:#eee">`;
const col = ['#e6b800', '#555', '#e0409a', '#3bb', '#88a', '#222', '#f60', '#2a6'];
for (const o of lv.obst) {
  const c = o.id < 0 ? '#999' : col[lv.hits[o.id].song];
  if (o.seg) svg += `<line x1="${X(o.seg[0])}" y1="${Y(o.seg[1])}" x2="${X(o.seg[2])}" y2="${Y(o.seg[3])}" stroke="${c}" stroke-width="${0.1 * S}"/>`;
  else svg += `<circle cx="${X(o.x)}" cy="${Y(o.y)}" r="${o.r * S}" fill="${c}" opacity=".6"/>`;
}
let path = '';
for (let t = 0; t <= lv.T; t += 1 / 120) { const p = lv.posAt(t); path += `${path ? 'L' : 'M'}${X(p[0])},${Y(p[1])}`; }
svg += `<path d="${path}" fill="none" stroke="#d22" stroke-width="1"/>`;
let cpath = '';
for (let t = 0; t <= lv.T; t += 1 / 30) { const p = lv.camAt(t); cpath += `${cpath ? 'L' : 'M'}${X(p[0])},${Y(p[1])}`; }
svg += `<path d="${cpath}" fill="none" stroke="#22d" stroke-width="1" stroke-dasharray="4 3"/>`;
for (const h of lv.hits) svg += `<circle cx="${X(h.x)}" cy="${Y(h.y)}" r="${R * S}" fill="none" stroke="#d22" stroke-width=".6"/>`;
for (const d of lv.decals) svg += `<rect x="${X(d.x - d.hw)}" y="${Y(d.y + d.size / 2)}" width="${d.hw * 2 * S}" height="${d.size * S}" fill="none" stroke="#06c"/><text x="${X(d.x)}" y="${Y(d.y - d.size * 0.3)}" font-size="${d.size * S * 0.8}" text-anchor="middle" fill="#06c">${d.text}</text>`;
svg += '</svg>';
writeFileSync(out + '.svg', svg);

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: Math.ceil((maxX - minX) * S), height: Math.ceil((maxY - minY) * S) } });
await page.setContent(`<body style="margin:0">${svg}</body>`);
await page.screenshot({ path: out + '.png' });
await browser.close();
console.log('wrote', out + '.png');
