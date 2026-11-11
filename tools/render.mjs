// Frame-accurate renderer: drives the page's ?render mode in headless Chrome and pipes frames to ffmpeg.
//   node tools/render.mjs shots 0,3.5,12 [--w 540 --h 960 --out /tmp/shots --seed 304]
//   node tools/render.mjs video [--fps 60 --w 1080 --h 1920 --out output/音乐小球.mp4 --start 0 --seed 304]
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [mode = 'video', ...rest] = process.argv.slice(2);
const opt = { w: 1080, h: 1920, fps: 60, start: 0, out: mode === 'video' ? join(ROOT, 'output/音乐小球.mp4') : '/tmp/ballref/shots' };
const positional = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) { opt[rest[i].slice(2)] = rest[i + 1]; i++; } else positional.push(rest[i]);
}
for (const k of ['w', 'h', 'fps', 'start']) opt[k] = +opt[k];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: opt.w, height: opt.h }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
const q = new URLSearchParams({ render: 1, w: opt.w, h: opt.h });
for (const k of ['seed', 'yaw', 'pitch']) if (opt[k] !== undefined) q.set(k, opt[k]);
await page.goto(`http://127.0.0.1:${port}/index.html?${q}`);
await page.waitForFunction(() => window.__mb, null, { timeout: 60000 });
const info = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
  return { T: __mb.T, secs: __mb.secs, gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown' };
});
console.log(`T=${info.T.toFixed(3)}s gpu=${info.gpu}`);
console.log(info.secs.map((s, i) => `${i + 1}.${s.name} ${s.tFirst.toFixed(1)}-${s.tLast.toFixed(1)}`).join('  '));

const grab = async (tau) => Buffer.from((await page.evaluate(t => __mb.frame(t), tau)).split(',')[1], 'base64');

if (mode === 'shots') {
  mkdirSync(opt.out, { recursive: true });
  const times = (positional[0] || '0').split(',').map(Number);
  for (const t of times) {
    const f = join(opt.out, `t${t.toFixed(2).padStart(6, '0')}.jpg`);
    writeFileSync(f, await grab(t));
    console.log(f);
  }
} else {
  mkdirSync(dirname(opt.out), { recursive: true });
  const wavPath = opt.out.replace(/\.mp4$/, '.wav');
  console.log('rendering audio...');
  writeFileSync(wavPath, Buffer.from(await page.evaluate(s => __mb.audio(s), opt.start), 'base64'));
  const total = Math.round(info.T * opt.fps);
  const ff = spawn('ffmpeg', [
    '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(opt.fps), '-c:v', 'mjpeg', '-i', '-',
    '-i', wavPath, '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', opt.out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c ? rej(new Error('ffmpeg exit ' + c)) : res())));
  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    const buf = await grab(opt.start + f / opt.fps);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 120 === 0) process.stdout.write(`\rframe ${f}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await done;
  console.log(`\nwrote ${opt.out}`);
}
await browser.close();
server.close();
