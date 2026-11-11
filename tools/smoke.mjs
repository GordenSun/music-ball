// Smoke test: loads the interactive page, starts playback, answers a quiz, and saves screenshots.
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.argv[2];
const out = process.argv[3] || '/tmp/ballref/smoke';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
  createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = url || `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
let errors = 0;
for (const [name, vp] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 2, hasTouch: name === 'mobile' });
  page.on('console', m => { if (m.type() === 'error') { errors++; console.log(`[${name}]`, m.text(), m.location().url); } });
  page.on('pageerror', e => { errors++; console.log(`[${name}] pageerror`, e.message); });
  await page.goto(base);
  await page.waitForSelector('#go');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}-${name}-0.png` });
  await page.click('#go');
  await page.waitForSelector('#quiz:not([hidden])', { timeout: 8000 });
  await page.screenshot({ path: `${out}-${name}-1.png` });
  await page.click('#quizOpts button');
  await page.waitForTimeout(500);
  await page.click('#next');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}-${name}-2.png` });
  const st = await page.evaluate(() => ({ time: document.getElementById('time').textContent, chip: document.getElementById('chip').textContent, score: document.getElementById('score').textContent, playing: document.body.classList.contains('playing') }));
  console.log(name, JSON.stringify(st));
  await page.close();
}
await browser.close();
server.close();
console.log(errors ? `${errors} error(s)` : 'no errors');
