import * as THREE from 'three';
import { R, ZB, PROPS } from './level.js';

const PASTEL = [0x6ff0dc, 0xff8fd8, 0xb49bff, 0xffe066, 0xff9a7a, 0x8dff7a, 0x7ac8ff];
const STEP_GLOW = [0x86f2ea, 0xffa0e2, 0xb7b0ff];
const VIVID = [0x62d94a, 0xff3d9e, 0x35c4f0, 0x9a4cf2, 0xff7417];
const CUBE = [0xff6a1f, 0x6edc4a, 0xf044a8, 0x8f86f5];

const ENV = { map: null };
export const setEnvMap = (tex) => { ENV.map = tex; };

const geos = {};
const geo = (key, make) => geos[key] || (geos[key] = make());
const box = () => geo('box', () => new THREE.BoxGeometry(1, 1, 1));

const M = {
  metal: new THREE.MeshStandardMaterial({ color: 0xd4d7db, metalness: 1, roughness: 0.22 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x24262a, metalness: 0.5, roughness: 0.4 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.3 }),
  black: new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.35 }),
  duckBeak: new THREE.MeshStandardMaterial({ color: 0xff6a14, roughness: 0.5 }),
  duckBase: new THREE.MeshStandardMaterial({ color: 0x6a4a3c, roughness: 0.7 }),
  barBase: new THREE.MeshStandardMaterial({ color: 0xb9bcc2, metalness: 0.6, roughness: 0.4 }),
};

function mesh(g, m, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}

// Rod from the wall out to local z = zEnd, with a ball knob on the tip.
function peg(parent, x, y, zEnd, knob = true, zWall = -ZB) {
  const g = geo('peg', () => new THREE.CylinderGeometry(0.032, 0.032, 1, 10).rotateX(Math.PI / 2));
  const len = zEnd - zWall;
  mesh(g, M.metal, parent, x, y, zWall + len / 2, 1, 1, len);
  if (knob) mesh(geo('knob', () => new THREE.SphereGeometry(0.07, 14, 10)), M.metal, parent, x, y, zEnd);
}

const kick = (age, amp) => amp * Math.exp(-age * 13) * Math.cos(age * 30);
const hold = (age, t0, tau) => (age < t0 ? 1 : Math.exp(-(age - t0) / tau));

function frame(parent, mat, hw, hd, y, th = 0.035) {
  const g = new THREE.Group();
  g.position.y = y;
  parent.add(g);
  for (const s of [-1, 1]) {
    const a = mesh(box(), mat, g, 0, 0, s * hd, hw * 2 + th, th, th);
    const b = mesh(box(), mat, g, s * hw, 0, 0, th, th, hd * 2 + th);
    a.castShadow = b.castShadow = false;
  }
  return g;
}

function flat(h, group) {
  const hw = PROPS[h.prop].rad * h.s;
  const body = new THREE.Group();
  body.position.set(h.off * hw, -R, 0);
  group.add(body);
  const pegY = -R - 0.2;
  let color, update;

  if (h.prop === 'tile') {
    color = PASTEL[Math.floor(h.r1 * PASTEL.length)];
    const glass = new THREE.MeshStandardMaterial({
      color: 0x353a42, roughness: 0.1, metalness: 0.35, transparent: true, opacity: 0.84,
      emissive: color, emissiveIntensity: 0,
    });
    mesh(box(), glass, body, 0, -0.035, 0, hw * 2, 0.07, 1.0);
    mesh(box(), M.metal, body, 0, -0.085, 0, hw * 2 + 0.06, 0.03, 1.06);
    peg(group, h.off * hw + hw * 0.55, pegY, 0.62);
    update = (age) => {
      const I = hold(age, 0.2, 0.3);
      glass.emissiveIntensity = 1.35 * I;
      glass.opacity = 0.84 + 0.16 * I;
      body.position.y = -R - kick(age, 0.09);
    };
  } else if (h.prop === 'step') {
    color = STEP_GLOW[h.i % STEP_GLOW.length];
    const glass = new THREE.MeshStandardMaterial({
      color: 0x9db6be, roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.62,
      emissive: color, emissiveIntensity: 0,
    });
    mesh(box(), glass, body, 0, -0.03, 0, hw * 2, 0.06, 1.0);
    const leg = geo('leg', () => new THREE.CylinderGeometry(0.022, 0.022, 0.2, 8));
    for (const z of [-0.36, 0.36]) mesh(leg, M.metal, body, 0, -0.16, z);
    mesh(box(), M.metal, body, 0, -0.26, 0, Math.min(0.12, hw), 0.03, 0.9);
    peg(group, h.off * hw, -R - 0.3, 0.5, h.i % 2 === 0);
    update = (age) => {
      const I = hold(age, 0.16, 0.3);
      glass.emissiveIntensity = 1.2 * I;
      glass.opacity = 0.62 + 0.35 * I;
      body.position.y = -R - kick(age, 0.05);
    };
  } else if (h.prop === 'edge') {
    color = [0xffd27a, 0xfff0c0, 0xffb060][h.i % 3];
    mesh(box(), M.black, body, 0, -0.06, 0, hw * 2, 0.12, 0.75);
    const rim = new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 0.4, emissive: color, emissiveIntensity: 0 });
    frame(body, rim, hw - 0.02, 0.355, -0.012);
    frame(body, rim, Math.max(0.05, hw - 0.14), 0.22, 0.004, 0.022);
    peg(group, h.off * hw - hw * 0.5, pegY, 0.5);
    update = (age) => {
      rim.emissiveIntensity = 2.6 * hold(age, 0.1, 0.25);
      body.position.y = -R - kick(age, 0.07);
    };
  } else {
    color = new THREE.Color().setHSL(((h.midi * 7) % 12) / 12, 0.62, 0.5).getHex();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.1, emissive: color, emissiveIntensity: 0 });
    const rim = new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0 });
    mesh(box(), mat, body, 0, -0.07, 0, hw * 2, 0.14, 0.85);
    frame(body, rim, hw * 0.72, 0.3, 0.003, 0.03);
    mesh(box(), M.barBase, body, 0, -0.2, 0, hw * 1.7, 0.12, 0.62);
    peg(group, h.off * hw, -R - 0.3, 0.48);
    update = (age) => {
      const I = hold(age, 0.08, 0.22);
      mat.emissiveIntensity = 0.75 * I;
      rim.emissiveIntensity = 2.4 * I;
      body.position.y = -R - kick(age, 0.08);
    };
  }
  return { color, update };
}

function cube(h, group) {
  const a = PROPS.cube.rad * 2 * h.s;
  const color = CUBE[Math.floor(h.r1 * CUBE.length)];
  const body = new THREE.Group();
  body.position.set(h.off * a / 2, -R - a / 2, 0);
  group.add(body);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.05, emissive: color, emissiveIntensity: 0 });
  mesh(box(), mat, body, 0, 0, 0, a, a, a);
  const disc = geo('disc', () => new THREE.CircleGeometry(1, 28));
  mesh(disc, M.black, body, 0, 0, a / 2 + 0.004, a * 0.4, a * 0.4, 1).castShadow = false;
  const cone = mesh(geo('cone', () => new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2)), M.dark, body, 0, 0, a / 2, a * 0.3, a * 0.3, a * 0.1);
  mesh(geo('dome', () => new THREE.SphereGeometry(1, 14, 10)), M.gold, body, 0, 0, a / 2 + a * 0.09, a * 0.1, a * 0.1, a * 0.07);
  peg(group, h.off * a / 2, -R - a / 2, -a / 2, false);
  const update = (age) => {
    mat.emissiveIntensity = 0.7 * hold(age, 0.05, 0.2);
    const p = 1 + kick(age, 0.12);
    body.scale.set(p, 2 - p, p);
    cone.scale.z = a * (0.1 + kick(age, 0.22));
    body.position.y = -R - a / 2 - kick(age, 0.06);
  };
  return { color, update };
}

function horn(h, group) {
  const s = h.s, rad = PROPS.horn.rad;
  const color = VIVID[Math.floor(h.r1 * VIVID.length)];
  const body = new THREE.Group();
  body.position.set(0, -R - rad * s, 0);
  group.add(body);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.22, metalness: 0.15, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0 });
  const bell = geo('bell', () => {
    const pts = [[0.09, -0.52], [0.1, -0.4], [0.12, -0.28], [0.17, -0.17], [0.25, -0.09], [0.34, -0.035], [0.42, 0]]
      .map(p => new THREE.Vector2(p[0], p[1]));
    return new THREE.LatheGeometry(new THREE.SplineCurve(pts).getPoints(18), 32).rotateX(Math.PI / 2);
  });
  mesh(bell, mat, body);
  mesh(geo('bellRim', () => new THREE.TorusGeometry(0.42, 0.03, 10, 36)), mat, body);
  mesh(geo('bellCap', () => new THREE.SphereGeometry(0.1, 14, 10)), mat, body, 0, 0, -0.52);
  mesh(geo('bellRing', () => new THREE.TorusGeometry(0.19, 0.022, 8, 28)), M.dark, body, 0, 0, -0.13).castShadow = false;
  mesh(geo('bellKnob', () => new THREE.SphereGeometry(0.085, 14, 10)), M.gold, body, 0, 0, -0.17).castShadow = false;
  body.scale.setScalar(s);
  const ry = (h.r2 < 0.5 ? -1 : 1) * (0.5 + 0.3 * h.r1);
  body.rotation.y = ry;
  peg(group, -0.5 * s * Math.sin(ry), -R - rad * s, -0.5 * s * Math.cos(ry), false);
  const update = (age) => {
    mat.emissiveIntensity = 0.55 * hold(age, 0.05, 0.2);
    body.scale.setScalar(s * (1 + kick(age, 0.16)));
  };
  return { color, update };
}

function gem(h, group) {
  const s = h.s, hw = PROPS.gem.rad * s;
  const body = new THREE.Group();
  body.position.set(h.off * hw, -R, 0);
  group.add(body);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd4e4ff, metalness: 1, roughness: 0.06, flatShading: true, envMap: ENV.map, envMapIntensity: 1.15,
    emissive: 0x8cc4ff, emissiveIntensity: 0.06,
  });
  const spin = new THREE.Group();
  body.add(spin);
  mesh(geo('crown', () => new THREE.CylinderGeometry(0.3, 0.5, 0.17, 8)), mat, spin, 0, -0.085, 0);
  mesh(geo('pavilion', () => new THREE.ConeGeometry(0.5, 0.52, 8).rotateX(Math.PI)), mat, spin, 0, -0.43, 0);
  body.scale.setScalar(s);
  peg(group, h.off * hw, -R - 0.3 * s, 0, false);
  const update = (age) => {
    mat.emissiveIntensity = 0.06 + 0.7 * hold(age, 0.04, 0.25);
    spin.rotation.y = h.r1 * 3 + (Math.PI * 0.75) * (1 - Math.exp(-age / 0.3));
    body.position.y = -R - kick(age, 0.08);
  };
  return { color: 0xbfe2ff, update };
}

function duck(h, group, theta) {
  const s = h.s, f = h.r2 < 0.5 ? -1 : 1;
  const d = new THREE.Group();
  d.position.set(0, -R - 0.25 * s, 0);
  const baseRot = -theta * 0.6 + (h.r1 - 0.5) * 0.3;
  d.rotation.z = baseRot;
  d.scale.setScalar(s);
  group.add(d);
  const inner = new THREE.Group();
  inner.rotation.y = -f * 0.5;
  d.add(inner);
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffc41f, roughness: 0.42, emissive: 0xffa200, emissiveIntensity: 0 });
  const sph = geo('duckSphere', () => new THREE.SphereGeometry(1, 24, 18));
  mesh(sph, yellow, inner, 0, 0, 0, 0.25, 0.25, 0.25);
  mesh(sph, yellow, inner, -0.1 * f, -0.4, 0, 0.37, 0.27, 0.3);
  mesh(sph, yellow, inner, -0.42 * f, -0.3, 0, 0.14, 0.1, 0.16).rotation.z = -0.7 * f;
  for (const z of [-1, 1]) {
    mesh(sph, yellow, inner, -0.12 * f, -0.38, z * 0.26, 0.2, 0.13, 0.07);
    mesh(sph, M.black, inner, 0.15 * f, 0.07, z * 0.17, 0.036, 0.042, 0.036).castShadow = false;
  }
  mesh(sph, M.duckBeak, inner, 0.27 * f, -0.03, 0, 0.11, 0.05, 0.11);
  mesh(box(), M.duckBase, d, -0.03 * f, -0.7, 0, 0.66, 0.07, 0.56);
  peg(d, -0.03 * f, -0.74, 0.3, true, -ZB / s);
  const side = f;
  const update = (age) => {
    const q = kick(age, 0.2);
    d.scale.set(s * (1 + q * 0.5), s * (1 - q), s * (1 + q * 0.5));
    d.rotation.z = baseRot + 0.2 * Math.exp(-age / 0.28) * Math.sin(age * 19) * side;
    yellow.emissiveIntensity = 0.35 * hold(age, 0.03, 0.15);
  };
  return { color: 0xffd76a, update };
}

export function makeProp(h) {
  const group = new THREE.Group();
  const theta = Math.atan2(-h.nx, h.ny);
  group.position.set(h.x, h.y, ZB);
  group.rotation.z = theta;
  const kind = PROPS[h.prop].kind;
  const r = kind === 'flat' ? flat(h, group)
    : kind === 'box' ? (h.prop === 'gem' ? gem(h, group) : cube(h, group))
      : h.prop === 'horn' ? horn(h, group) : duck(h, group, theta);
  r.update(100);
  return { group, hit: h, color: new THREE.Color(r.color), update: r.update, dirty: false };
}

export const sharedMaterials = M;
