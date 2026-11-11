// Scans seeds for a collision-free level with small horizontal drift.
import { _generate } from '../js/level.js';
const rows = [];
for (let seed = 1; seed <= 400; seed++) {
  const lv = _generate(seed, seed % 2 ? 1 : -1);
  if (lv.violations) continue;
  const xs = lv.hits.map(h => h.x);
  rows.push({ seed, T: +lv.T.toFixed(2), Dx: +lv.D[0].toFixed(1), Dy: +lv.D[1].toFixed(1), span: +(Math.max(...xs) - Math.min(...xs)).toFixed(1) });
}
rows.sort((a, b) => a.span - b.span);
console.log(rows.length, 'valid of 400');
console.table(rows.slice(0, 12));
