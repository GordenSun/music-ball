import { buildLevel, mulberry32 } from './level.js';
import { SONGS, DECOYS } from './songs.js';
import { Stage } from './scene.js';
import { Player, renderLoop } from './audio.js';

const DEFAULT_SEED = 304;
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const canvas = $('stage');
let seed = +params.get('seed') || DEFAULT_SEED;
let level = buildLevel(seed);

if (params.has('render')) capture();
else {
  try { app(); } catch (err) {
    console.error(err);
    $('go').textContent = '加载失败，请换个浏览器试试';
  }
}

// Headless frame-by-frame capture mode, driven by tools/render.mjs.
function capture() {
  document.body.classList.add('capture');
  const w = +params.get('w') || 1080, h = +params.get('h') || 1920;
  const stage = new Stage(canvas, { capture: true, shadowSize: 4096 });
  stage.setLevel(level);
  stage.resize(w, h, 1);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  if (params.has('yaw')) stage.view.yaw = +params.get('yaw');
  if (params.has('pitch')) stage.view.pitch = +params.get('pitch');
  window.__mb = {
    T: level.T,
    secs: level.secs.map(s => ({ name: s.name, tRail: s.tRail, tFirst: s.tFirst, tLast: s.tLast })),
    draw(tau) { stage.render(tau); },
    frame(tau, quality = 0.94) { stage.render(tau); return canvas.toDataURL('image/jpeg', quality); },
    async audio(tauStart = 0) {
      const bytes = await renderLoop(level, tauStart);
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    },
  };
  stage.render(0);
}

function app() {
  const stage = new Stage(canvas, { shadowSize: matchMedia('(pointer: coarse)').matches ? 1024 : 2048 });
  const player = new Player(level);
  stage.setLevel(level);
  const S = SONGS.length;
  let quizOn = true, reveal = false, answers, options, cur = -1, lastTau = 0, shownFor = -1, hideAt = 0, toastTimer;
  document.body.classList.add('quiz');

  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const toast = (msg, ms = 2600) => {
    $('toast').textContent = msg;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), ms);
  };

  function resetRound() {
    answers = Array(S).fill(null);
    const rnd = mulberry32(seed * 31 + Date.now() % 100000);
    options = SONGS.map((song) => {
      const others = SONGS.map(s => s.name).filter(n => n !== song.name), pool = [...DECOYS];
      const picks = [song.name, others[Math.floor(rnd() * others.length)]];
      while (picks.length < 4) picks.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
      for (let i = picks.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [picks[i], picks[j]] = [picks[j], picks[i]];
      }
      return picks;
    });
    shownFor = -1;
    $('quiz').hidden = true;
    $('scoreNum').textContent = '0';
  }

  function buildMarks() {
    $('marks').innerHTML = level.secs.slice(1).map(s => `<i style="left:${(s.tRail / level.T * 100).toFixed(3)}%"></i>`).join('');
  }

  function songAt(tau) {
    let k = 0;
    while (k + 1 < S && level.secs[k + 1].tRail <= tau) k++;
    return k;
  }

  function showQuiz(k) {
    shownFor = k;
    hideAt = 0;
    $('quizTitle').textContent = `第 ${k + 1} 首 · 这是什么歌？`;
    const box = $('quizOpts');
    box.innerHTML = '';
    for (const name of options[k]) {
      const b = document.createElement('button');
      b.textContent = name;
      b.onclick = () => {
        const ok = name === SONGS[k].name;
        answers[k] = ok ? 'right' : 'wrong';
        for (const o of box.children) {
          o.disabled = true;
          if (o.textContent === SONGS[k].name) o.classList.add('right');
        }
        if (!ok) b.classList.add('wrong');
        $('scoreNum').textContent = answers.filter(a => a === 'right').length;
        hideAt = performance.now() + 1300;
      };
      box.appendChild(b);
    }
    $('quiz').hidden = false;
  }

  function updateUI(tau) {
    const T = level.T;
    if (player.playing && tau < lastTau - T / 2) {
      if (quizOn && answers.some(a => a)) toast(`这一轮猜对 ${answers.filter(a => a === 'right').length} / ${S} 首，再来一轮`, 4200);
      resetRound();
    }
    lastTau = tau;
    const k = songAt(tau);
    if (k !== cur) {
      cur = k;
      $('chipNo').textContent = `第 ${k + 1} / ${S} 首`;
      [...$('marks').children].forEach((m, i) => m.classList.toggle('done', i < k));
    }
    $('chipName').textContent = reveal || answers[k] ? SONGS[k].name : '？？？';
    const sec = level.secs[k];
    if (quizOn && player.playing && !answers[k] && shownFor !== k && tau >= sec.tFirst + 0.8) showQuiz(k);
    if (!$('quiz').hidden && (shownFor !== k || !quizOn || (hideAt && performance.now() > hideAt))) $('quiz').hidden = true;
    const pct = (tau / T * 100).toFixed(3) + '%';
    $('trackFill').style.width = pct;
    $('knob').style.left = pct;
    $('time').textContent = `${fmt(tau)} / ${fmt(T)}`;
  }

  function setPlaying(on) {
    if (on) player.play(); else player.pause();
    document.body.classList.toggle('playing', on);
  }
  const jump = (k) => player.seek(level.secs[(k + S) % S].tRail + 0.001);

  function resize() {
    stage.resize(innerWidth, innerHeight, Math.min(devicePixelRatio || 1, 2));
  }
  addEventListener('resize', resize);
  resize();
  resetRound();
  buildMarks();

  $('go').onclick = () => {
    $('start').classList.add('gone');
    setPlaying(true);
  };
  $('go').textContent = '开始播放';
  $('go').disabled = false;
  $('play').onclick = () => setPlaying(!player.playing);
  $('prev').onclick = () => {
    const tau = player.now(), k = songAt(tau);
    jump(tau - level.secs[k].tRail > 2.5 ? k : k - 1);
  };
  $('next').onclick = () => jump(songAt(player.now()) + 1);
  $('quizBtn').onclick = () => {
    quizOn = !quizOn;
    $('quizBtn').classList.toggle('on', quizOn);
    document.body.classList.toggle('quiz', quizOn);
    toast(quizOn ? '猜歌模式：开' : '欣赏模式：只看不猜', 1600);
  };
  $('reveal').onclick = () => {
    reveal = !reveal;
    $('reveal').classList.toggle('on', reveal);
  };
  const rates = [1, 1.5, 0.5];
  $('speed').onclick = () => {
    const r = rates[(rates.indexOf(player.rate) + 1) % rates.length];
    player.setRate(r);
    $('speed').textContent = r + '×';
    $('speed').classList.toggle('on', r !== 1);
  };
  $('mute').onclick = () => {
    player.setMuted(!player.muted);
    document.body.classList.toggle('muted', player.muted);
  };
  $('shuffle').onclick = () => {
    seed = 1 + Math.floor(Math.random() * 99999);
    level = buildLevel(seed);
    stage.setLevel(level);
    player.setLevel(level);
    cur = -1;
    resetRound();
    buildMarks();
    history.replaceState(null, '', `?seed=${seed}`);
    toast('换了一面新的墙', 1600);
  };
  $('fs').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };

  // progress bar scrubbing
  const track = $('track');
  const scrub = (e) => {
    const r = track.getBoundingClientRect();
    player.seek(Math.max(0, Math.min(0.9999, (e.clientX - r.left) / r.width)) * level.T);
  };
  track.addEventListener('pointerdown', (e) => {
    track.setPointerCapture(e.pointerId);
    scrub(e);
    track.onpointermove = scrub;
  });
  track.addEventListener('pointerup', () => { track.onpointermove = null; });
  track.addEventListener('pointercancel', () => { track.onpointermove = null; });

  // camera: drag to orbit, wheel / pinch to zoom, tap to toggle, double-click to reset
  const pts = new Map();
  let moved = 0, pinch = 0;
  const clampView = () => {
    const v = stage.view;
    v.yaw = Math.max(-0.9, Math.min(0.9, v.yaw));
    v.pitch = Math.max(-0.55, Math.min(0.75, v.pitch));
    v.zoom = Math.max(0.55, Math.min(2.2, v.zoom));
  };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) moved = 0;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p[0], dy = e.clientY - p[1];
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) {
      moved += Math.abs(dx) + Math.abs(dy);
      stage.view.yaw -= dx * 0.004;
      stage.view.pitch += dy * 0.004;
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) stage.view.zoom *= d / pinch;
      pinch = d;
      moved = 99;
    }
    clampView();
  });
  const release = (e) => {
    if (pts.delete(e.pointerId) && pts.size === 0 && moved < 6 && e.type === 'pointerup' && $('start').classList.contains('gone')) {
      setPlaying(!player.playing);
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    stage.view.zoom *= Math.exp(-e.deltaY * 0.0012);
    clampView();
  }, { passive: false });
  canvas.addEventListener('dblclick', () => { Object.assign(stage.view, { yaw: 0, pitch: 0, zoom: 1 }); });

  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
    if (!$('start').classList.contains('gone')) {
      if (e.code === 'Space' || e.code === 'Enter') $('go').click();
      return;
    }
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!player.playing); }
    else if (e.code === 'ArrowRight') $('next').click();
    else if (e.code === 'ArrowLeft') $('prev').click();
    else if (e.code === 'KeyM') $('mute').click();
    else if (e.code === 'KeyF') $('fs').click();
    else if (e.code === 'KeyR') player.seek(0);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && player.playing) setPlaying(false); });

  const loop = () => {
    const tau = player.tick();
    stage.render(tau);
    updateUI(tau);
    requestAnimationFrame(loop);
  };
  loop();
}
