// js/ui/townBackground.js — Three.js 3D 町背景
// 星空 + 建物シルエット + 松明の炎と光 + 立ち昇る火の粉
// Poly Haven (CC0) の夜景HDRをオプションで環境光に使用
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

let renderer, scene, camera, animId;
let torchLights = [];
let emberSystems = [];
let clock = new THREE.Clock();

/* ── 建物の配置定義 ─────────────────────────────────────────────── */
const BUILDINGS = [
  // 中央城塞
  { x:   0, w: 30, h: 28, d: 14, c: 0x2a1e38 },  // 大ホール
  { x: -16, w:  8, h: 40, d:  8, c: 0x2e2240 },  // 左塔
  { x:  16, w:  8, h: 40, d:  8, c: 0x2e2240 },  // 右塔
  { x:   0, w:  5, h: 50, d:  5, c: 0x342848 },  // 中央尖塔
  // 左側建物群
  { x: -32, w: 13, h: 22, d: 10, c: 0x201630 },
  { x: -46, w:  9, h: 32, d:  8, c: 0x241a34 },
  { x: -57, w: 10, h: 18, d:  8, c: 0x1c1228 },
  { x: -68, w:  7, h: 26, d:  7, c: 0x20162e },
  { x: -77, w:  9, h: 14, d:  8, c: 0x180e22 },
  { x: -86, w:  6, h: 20, d:  6, c: 0x1a1026 },
  { x: -93, w:  8, h: 12, d:  7, c: 0x160c1e },
  // 右側建物群
  { x:  32, w: 13, h: 20, d: 10, c: 0x201630 },
  { x:  46, w: 10, h: 30, d:  9, c: 0x241a34 },
  { x:  57, w:  8, h: 17, d:  7, c: 0x1c1228 },
  { x:  68, w: 11, h: 24, d:  9, c: 0x20162e },
  { x:  78, w:  7, h: 18, d:  6, c: 0x180e22 },
  { x:  87, w:  9, h: 14, d:  7, c: 0x1a1026 },
  { x:  95, w:  7, h: 10, d:  6, c: 0x160c1e },
];

/* 奥に見える遠景の建物（もっとフラット） */
const FAR_BUILDINGS = [
  { x: -50, w: 20, h: 14, d: 8, c: 0x100a18 },
  { x: -20, w: 15, h: 18, d: 8, c: 0x100a18 },
  { x:  25, w: 14, h: 12, d: 8, c: 0x100a18 },
  { x:  60, w: 18, h: 16, d: 8, c: 0x100a18 },
  { x: -75, w: 12, h: 10, d: 6, c: 0x0c0812 },
  { x:  80, w: 12, h:  9, d: 6, c: 0x0c0812 },
];

/* 松明の X 位置 */
const TORCH_X = [-62, -42, -20, 0, 20, 42, 62];

export function initTownBackground() {
  const canvas = document.getElementById('town-bg-canvas');
  if (!canvas) return null;

  // ── Renderer ────────────────────────────────────────────
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.8;

  // ── Scene ────────────────────────────────────────────────
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06030f);
  scene.fog = new THREE.FogExp2(0x08050f, 0.006);

  // ── Camera ───────────────────────────────────────────────
  camera = new THREE.PerspectiveCamera(70, canvas.clientWidth / canvas.clientHeight, 0.1, 400);
  camera.position.set(0, 6, 22);
  camera.lookAt(0, 9, 0);

  // ── Lighting ─────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x302850, 3.5));
  const moonLight = new THREE.DirectionalLight(0x6070c0, 1.8);
  moonLight.position.set(-60, 80, -30);
  scene.add(moonLight);
  // 補助ライト（正面から建物を照らす）
  const fillLight = new THREE.DirectionalLight(0x804030, 1.2);
  fillLight.position.set(0, 20, 40);
  scene.add(fillLight);

  // ── Contents ─────────────────────────────────────────────
  buildStars();
  buildGround();
  buildCity();
  buildTorches();
  buildEmbers();

  // ── Poly Haven CC0 HDR（夜景）を環境光として非同期ロード ─────
  // "moonless_golf" — 暗い夜の野外シーン (polyhaven.com, CC0)
  new RGBELoader()
    .load(
      'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/moonless_golf_1k.hdr',
      (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = tex;  // 建物マテリアルの反射のみ影響・背景には使わない
      },
      undefined,
      () => { /* ネットワークなし時は無音で無視 */ }
    );

  window.addEventListener('resize', onResize);
  return { start, stop };
}

/* ── 星フィールド ─────────────────────────────────────────────── */
function buildStars() {
  const count = 2000;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 180 + Math.random() * 60;
    pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 5;
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xe8dfd8, size: 0.35, sizeAttenuation: true,
    transparent: true, opacity: 0.95,
  });
  scene.add(new THREE.Points(geo, mat));
}

/* ── 地面 ──────────────────────────────────────────────────────── */
function buildGround() {
  const mat = new THREE.MeshLambertMaterial({ color: 0x0c0810 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0;
  scene.add(mesh);
}

/* ── 建物シルエット ────────────────────────────────────────────── */
function buildCity() {
  // 遠景
  for (const b of FAR_BUILDINGS) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(b.w, b.h, b.d),
      new THREE.MeshLambertMaterial({ color: b.c })
    );
    mesh.position.set(b.x, b.h / 2, -70);
    scene.add(mesh);
  }

  // 前景
  for (const b of BUILDINGS) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(b.w, b.h, b.d),
      new THREE.MeshLambertMaterial({ color: b.c })
    );
    mesh.position.set(b.x, b.h / 2, -30);
    scene.add(mesh);

    // 建物の窓（小さなEmissive Plane）
    addWindows(b.x, b.h, -30 - b.d / 2 + 0.05);
  }
}

function addWindows(bx, bh, bz) {
  const rows   = Math.floor(bh / 8);
  const cols   = 3;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() < 0.35) continue; // ランダムに一部消灯
      const hue = 0.07 + Math.random() * 0.04; // 橙〜黄
      const lit = 0.28 + Math.random() * 0.18;  // 明るめ
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 1.0),
        new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue, 0.9, lit) })
      );
      win.position.set(
        bx + (c - 1) * 3.5,
        3 + r * 5 + Math.random() * 2,
        bz
      );
      scene.add(win);
    }
  }
}

/* ── 松明 & PointLight ─────────────────────────────────────────── */
function buildTorches() {
  for (const x of TORCH_X) {
    // PointLight
const light = new THREE.PointLight(0xff8030, 12.0, 60);
  light.position.set(x, 3.5, -10);
  scene.add(light);
  torchLights.push({ light, baseInt: 12.0 });

    // 柄 (Cylinder)
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.13, 0.9, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a1e08 })
    );
    pole.position.set(x, 2.7, -10);
    scene.add(pole);

    // 炎コア（球）
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff9930 })
    );
    flame.position.set(x, 3.4, -10);
    scene.add(flame);

    // 炎ハロー（大きめ・半透明・加算合成）
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff5500, transparent: true, opacity: 0.25,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    halo.position.set(x, 3.5, -10);
    scene.add(halo);
  }
}

/* ── 火の粉パーティクル ────────────────────────────────────────── */
function buildEmbers() {
  const count = 120;
  const pos   = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const tx = TORCH_X[i % TORCH_X.length];
    pos[i * 3]     = tx + (Math.random() - 0.5) * 4;
    pos[i * 3 + 1] = 3 + Math.random() * 10;
    pos[i * 3 + 2] = -10 + (Math.random() - 0.5) * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xff7010, size: 0.15, sizeAttenuation: true,
    transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  emberSystems.push({ pts, pos, count });
}

/* ── リサイズ ────────────────────────────────────────────────── */
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

/* ── アニメーションループ ────────────────────────────────────── */
function animate() {
  animId = requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // 松明フリッカー
  for (const { light, baseInt } of torchLights) {
    light.intensity = baseInt
      + Math.sin(t * 8.3 + light.position.x) * 0.7
      + Math.sin(t * 15.1 + light.position.x * 0.5) * 0.3;
  }

  // 火の粉上昇
  for (const em of emberSystems) {
    const p = em.pts.geometry.attributes.position.array;
    for (let i = 0; i < em.count; i++) {
      p[i * 3 + 1] += 0.014;
      p[i * 3]     += Math.sin(t * 0.9 + i * 1.3) * 0.004;
      if (p[i * 3 + 1] > 18) {
        const tx = TORCH_X[i % TORCH_X.length];
        p[i * 3]     = tx + (Math.random() - 0.5) * 3;
        p[i * 3 + 1] = 3.2;
        p[i * 3 + 2] = -10 + (Math.random() - 0.5) * 2;
      }
    }
    em.pts.geometry.attributes.position.needsUpdate = true;
  }

  // カメラ超低速ドリフト（遠近感のある揺れ）
  camera.position.x = Math.sin(t * 0.035) * 1.8;
  camera.lookAt(0, 9, 0);

  renderer.render(scene, camera);
}

export function start() {
  clock.start();
  animate();
}

export function stop() {
  cancelAnimationFrame(animId);
  clock.stop();
}
