import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { R, ZB } from './level.js';
import { makeProp, sharedMaterials, setEnvMap } from './props.js';

const FOV = 30;
const FONT = '"Xingkai SC","STXingkai","HanziPen SC","Kaiti SC","STKaiti","KaiTi","楷体",cursive';
const LIGHT_DIR = new THREE.Vector3(-0.5, 0.78, 0.92).normalize();
const GLOW_WEIGHT = { tile: 0.6, step: 0.55, edge: 0.6, bar: 0.5, gem: 0.3, horn: 0.14, cube: 0.2, duck: 0.1 };

function ballTextures() {
  const W = 512, H = 256;
  const make = (paint) => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    paint(c.getContext('2d'));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  };
  const bands = (g, width, color) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'butt';
    for (let i = -3; i < 8; i++) {
      g.beginPath();
      g.moveTo(i * 128 + 20, -10);
      g.bezierCurveTo(i * 128 + 60, 90, i * 128 + 110, 170, i * 128 + 148, H + 10);
      g.stroke();
    }
  };
  const map = make((g) => {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#ff6a2a'); grad.addColorStop(0.5, '#f2441c'); grad.addColorStop(1, '#d83212');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    bands(g, 44, '#7d1206');
    bands(g, 18, '#ffb640');
    bands(g, 7, '#fff0b0');
  });
  const emissive = make((g) => {
    g.fillStyle = '#3a0b02'; g.fillRect(0, 0, W, H);
    bands(g, 44, '#000');
    bands(g, 18, '#ff8a1e');
    bands(g, 7, '#ffe9a0');
  });
  return { map, emissive };
}

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function decalMesh(d, trash) {
  const px = 128, pad = 40;
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const font = `${px}px ${FONT}`;
  g.font = font;
  const w = Math.ceil(g.measureText(d.text).width);
  c.width = w + pad * 2; c.height = Math.ceil(px * 1.35) + pad * 2;
  g.font = font;
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(40,36,30,.5)';
  g.shadowBlur = 10; g.shadowOffsetX = 7; g.shadowOffsetY = 9;
  g.fillStyle = '#46464a';
  g.fillText(d.text, pad, c.height / 2);
  g.shadowColor = 'transparent';
  g.fillStyle = '#3b3b40';
  g.fillText(d.text, pad, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const k = d.size / px;
  const geo = new THREE.PlaneGeometry(c.width * k, c.height * k);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.92 });
  trash.push(tex, geo, mat);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(d.x, d.y, 0.015);
  m.rotation.z = d.rot || 0;
  m.renderOrder = 1;
  return m;
}

function railMesh(rail, trash) {
  const g = new THREE.Group();
  const pts = rail.pts, M = sharedMaterials;
  for (const dz of [-0.2, 0.2]) {
    const curve = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(q.x + q.nx * 0.26, q.y + q.ny * 0.26, ZB + dz)));
    const geo = new THREE.TubeGeometry(curve, pts.length * 2, 0.03, 8, false);
    trash.push(geo);
    const m = new THREE.Mesh(geo, M.metal);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  const pins = [];
  let next = 0.12;
  for (const q of pts) {
    if (q.s < next) continue;
    next = q.s + 0.5;
    pins.push(q);
  }
  const zTip = ZB + 0.32;
  const pegGeo = new THREE.CylinderGeometry(0.024, 0.024, 1, 8).rotateX(Math.PI / 2);
  const knobGeo = new THREE.SphereGeometry(0.055, 12, 8);
  trash.push(pegGeo, knobGeo);
  const pegs = new THREE.InstancedMesh(pegGeo, M.metal, pins.length);
  const knobs = new THREE.InstancedMesh(knobGeo, M.metal, pins.length + 4);
  const m4 = new THREE.Matrix4();
  pins.forEach((q, i) => {
    const x = q.x + q.nx * 0.315, y = q.y + q.ny * 0.315;
    m4.makeScale(1, 1, zTip).setPosition(x, y, zTip / 2);
    pegs.setMatrixAt(i, m4);
    m4.makeScale(1, 1, 1).setPosition(x, y, zTip);
    knobs.setMatrixAt(i, m4);
  });
  [pts[0], pts[pts.length - 1]].forEach((q, e) => {
    [-0.2, 0.2].forEach((dz, j) => {
      m4.makeScale(0.6, 0.6, 0.6).setPosition(q.x + q.nx * 0.26, q.y + q.ny * 0.26, ZB + dz);
      knobs.setMatrixAt(pins.length + e * 2 + j, m4);
    });
  });
  for (const im of [pegs, knobs]) {
    im.castShadow = im.receiveShadow = true;
    im.frustumCulled = false;
    g.add(im);
  }
  return g;
}

export class Stage {
  constructor(canvas, { capture = false, shadowSize = 2048 } = {}) {
    const renderer = this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, preserveDrawingBuffer: capture, powerPreference: 'high-performance',
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd9d8d6);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.3;
    setEnvMap(scene.environment);
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(FOV, 9 / 16, 1, 120);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe6e6e6, 0.9));
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    const sc = sun.shadow.camera;
    sc.left = -15; sc.right = 15; sc.top = 15; sc.bottom = -15; sc.near = 5; sc.far = 90;
    sun.shadow.radius = 7;
    sun.shadow.blurSamples = 16;
    sun.shadow.bias = -0.0004;
    scene.add(sun, sun.target);

    this.wall = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshStandardMaterial({ color: 0xd8d7d5, roughness: 0.96, metalness: 0, envMapIntensity: 0.2 }),
    );
    this.wall.receiveShadow = true;
    scene.add(this.wall);

    const tex = ballTextures();
    this.ball = new THREE.Group();
    this.spin = new THREE.Group();
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(R, 48, 32),
      new THREE.MeshStandardMaterial({
        map: tex.map, emissiveMap: tex.emissive, emissive: 0xffffff, emissiveIntensity: 1.25,
        roughness: 0.3, metalness: 0.25,
      }),
    );
    ballMesh.rotation.set(1.1, 0, 0.5);
    ballMesh.castShadow = true;
    this.spin.add(ballMesh);
    this.ball.add(this.spin);
    this.ballLight = new THREE.PointLight(0xff6a2a, 0.75, 2.6, 1.8);
    this.ballLight.position.set(0, 0, -0.25);
    this.ball.add(this.ballLight);
    scene.add(this.ball);

    const radial = radialTexture();
    const glowGeo = new THREE.PlaneGeometry(1, 1);
    this.glows = Array.from({ length: 14 }, () => {
      const m = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ map: radial, transparent: true, depthWrite: false, opacity: 0 }));
      m.visible = false;
      m.renderOrder = 2;
      scene.add(m);
      return m;
    });
    const ringGeo = new THREE.RingGeometry(0.86, 1, 40);
    this.rings = Array.from({ length: 6 }, () => {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 }));
      m.visible = false;
      m.renderOrder = 3;
      scene.add(m);
      return m;
    });

    this.view = { yaw: 0, pitch: 0, zoom: 1 };
    this.level = null;
    this.root = null;
    this.trash = [];
    this.tmp = new THREE.Vector3();
  }

  setLevel(level) {
    if (this.root) {
      this.scene.remove(this.root);
      this.trash.forEach(x => x.dispose());
      this.props.forEach(p => p.group.traverse(o => { if (o.material && !Object.values(sharedMaterials).includes(o.material)) o.material.dispose(); }));
    }
    this.trash = [];
    this.level = level;
    const root = this.root = new THREE.Group();
    this.scene.add(root);
    this.props = [];
    this.cull = [];
    const S = level.secs.length;
    const groups = level.secs.map(() => new THREE.Group());
    const add = (k, obj, x, y, r) => { groups[k].add(obj); this.cull.push({ obj, x, y, r }); };
    level.rails.forEach((rail, k) => {
      const a = rail.pts[0], b = rail.pts[rail.pts.length - 1];
      add(k, railMesh(rail, this.trash), (a.x + b.x) / 2, (a.y + b.y) / 2, 5);
    });
    for (const h of level.hits) {
      const p = makeProp(h);
      this.props.push(p);
      add(h.song, p.group, h.x, h.y, 1);
    }
    for (const d of level.decals) add(d.sec, decalMesh(d, this.trash), d.x, d.y, d.hw + 1);
    groups.forEach(g => root.add(g));
    const ghost = (k, sign) => {
      const g = groups[k].clone(true);
      g.position.set(sign * level.D[0], sign * level.D[1], 0);
      g.traverse(o => { o.visible = true; });
      root.add(g);
      const sec = level.secs[k], hs = level.hits.slice(sec.first, sec.last + 1);
      const ys = hs.map(h => h.y), xs = hs.map(h => h.x);
      this.cull.push({
        obj: g, x: (Math.min(...xs) + Math.max(...xs)) / 2 + sign * level.D[0],
        y: (Math.min(...ys) + Math.max(...ys)) / 2 + sign * level.D[1],
        r: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + 12,
      });
    };
    ghost(0, 1); ghost(1 % S, 1);
    ghost(S - 1, -1); ghost((S - 2 + S) % S, -1);
  }

  resize(w, h, dpr) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const viewH = Math.max(6.7 / this.camera.aspect, 9);
    this.dist = viewH / (2 * Math.tan(FOV * Math.PI / 360));
    this.camera.updateProjectionMatrix();
  }

  render(tauIn) {
    const lv = this.level, T = lv.T, D = lv.D;
    const tau = ((tauIn % T) + T) % T;
    const [bx, by] = lv.posAt(tau);
    this.ball.position.set(bx, by, ZB);
    this.spin.rotation.z = lv.spinAt(tau);

    const [cx, cy] = lv.camAt(tau);
    const a = 2 * Math.PI * tau / T, v = this.view;
    const yaw = 0.2 * Math.sin(3 * a + 0.4) + v.yaw;
    const pitch = 0.5 + 0.1 * Math.sin(2 * a + 1.3) + v.pitch;
    const roll = 0.07 * Math.sin(4 * a + 2.2);
    const tx = cx, ty = cy - 0.9, tz = 0.5, dist = this.dist / v.zoom;
    const cam = this.camera;
    cam.position.set(
      tx + dist * Math.sin(yaw) * Math.cos(pitch),
      ty + dist * Math.sin(pitch),
      tz + dist * Math.cos(yaw) * Math.cos(pitch),
    );
    cam.up.set(Math.sin(roll), Math.cos(roll), 0);
    cam.lookAt(tx, ty, tz);

    this.wall.position.set(tx, ty, 0);
    this.sun.position.set(tx, ty, 0).addScaledVector(LIGHT_DIR, 45);
    this.sun.target.position.set(tx, ty, 0);
    this.sun.target.updateMatrixWorld();

    for (const c of this.cull) {
      c.obj.visible = Math.abs(c.x - tx) < 13 + c.r && Math.abs(c.y - ty) < 13 + c.r;
    }

    const active = [];
    for (const p of this.props) {
      let age = tau - p.hit.t;
      const wrapped = age < 0;
      if (wrapped) age += T;
      if (age < 1.6) {
        p.update(age);
        p.dirty = true;
        if (age < 1.1) active.push({ p, age, wrapped });
      } else if (p.dirty) {
        p.update(100);
        p.dirty = false;
      }
    }
    active.sort((m, n) => m.age - n.age);
    this.glows.forEach((g, i) => {
      const e = active[i];
      const k = e ? GLOW_WEIGHT[e.p.hit.prop] * (e.age < 0.15 ? 1 : Math.exp(-(e.age - 0.15) / 0.3)) : 0;
      g.visible = k > 0.01;
      if (!g.visible) return;
      const h = e.p.hit, ox = e.wrapped ? -D[0] : 0, oy = e.wrapped ? -D[1] : 0;
      g.position.set(h.cx + ox + 0.25, h.cy + oy - 0.4, 0.02 + i * 0.001);
      g.scale.setScalar(3.4 + e.age * 1.5);
      g.material.color.copy(e.p.color);
      g.material.opacity = k;
    });
    this.rings.forEach((g, i) => {
      const e = active[i];
      g.visible = !!e && e.age < 0.4;
      if (!g.visible) return;
      const h = e.p.hit, ox = e.wrapped ? -D[0] : 0, oy = e.wrapped ? -D[1] : 0, u = e.age / 0.4;
      g.position.set(h.x - h.nx * R + ox, h.y - h.ny * R + oy, ZB + 0.3);
      g.scale.setScalar(0.18 + 0.75 * (1 - (1 - u) * (1 - u)));
      g.material.color.copy(e.p.color).lerp(new THREE.Color(0xffffff), 0.35);
      g.material.opacity = 0.75 * (1 - u);
    });

    this.renderer.render(this.scene, cam);
  }
}
