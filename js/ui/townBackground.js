// js/ui/townBackground.js — Three.js 3D 町背景
// FBX 城モデル + 星空 + 松明の炎と光 + 立ち昇る火の粉
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

let renderer, scene, camera, animId;
let torchLights = [];
let emberSystems = [];
let clock = new THREE.Clock();

/* ── テクスチャユーティリティ ──────────────────────────────────── */
const TEX_LOADER = new THREE.TextureLoader();
const TEX_CACHE  = new Map();

// 4つのバリエーションパス
const VARIATIONS = {
  dark:  '/3Dobject_data/castle/maps/Variation-Dark_Bricks/',
  brown: '/3Dobject_data/castle/maps/Variation-Brown_Bricks/',
  old:   '/3Dobject_data/castle/maps/Variation-Old_Bricks/',
  light: '/3Dobject_data/castle/maps/Variation_Light_Bricks/',
};

function getTex(url, srgb = true) {
  if (!TEX_CACHE.has(url)) {
    const t = TEX_LOADER.load(url);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
    TEX_CACHE.set(url, t);
  }
  return TEX_CACHE.get(url);
}

function makeMat(prefix, base) {
  return new THREE.MeshStandardMaterial({
    map:          getTex(base + prefix + 'BaseColor.png'),
    normalMap:    getTex(base + prefix + 'Normal.png',            false),
    roughnessMap: getTex(base + prefix + 'Roughness.png',         false),
    aoMap:        getTex(base + prefix + 'Ambient_Occlusion.png', false),
    metalnessMap: getTex(base + prefix + 'Metallic.png',          false),
    roughness: 0.80,
    metalness: 0.05,
  });
}

const TORCH_X = [-30, -15, 0, 15, 30];
const TORCH_Z = 5;  // 手前に移動

export function initTownBackground() {
  const canvas = document.getElementById('town-bg-canvas');
  if (!canvas) return null;

  // ── Renderer ────────────────────────────────────────────
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2.2;

  // ── Scene ────────────────────────────────────────────────
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0825);
  scene.fog = new THREE.FogExp2(0x0d0825, 0.008);

  // ── Camera ───────────────────────────────────────────────
  camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 10, 55);
  camera.lookAt(0, 5, -40);

  // ── Lighting ─────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x5060a0, 5.0));
  const moonLight = new THREE.DirectionalLight(0x8090d0, 5.0);
  moonLight.position.set(-80, 100, 30);
  scene.add(moonLight);
  // 正面からの補助ライト
  const fillLight = new THREE.DirectionalLight(0x6080c8, 2.5);
  fillLight.position.set(0, 30, 60);
  scene.add(fillLight);
  // 上方からの補助
  const topLight = new THREE.DirectionalLight(0x4050a8, 2.0);
  topLight.position.set(0, 60, 0);
  scene.add(topLight);

  // ── Contents ─────────────────────────────────────────────
  buildStars();
  buildGround();
  buildFBXCity();
  buildTorches();
  buildEmbers();

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

/* ── FBX 城モデル読み込み ──────────────────────────────────────── */
function loadFbx(url) {
  return new Promise(resolve => {
    new FBXLoader().load(url, resolve, undefined, () => resolve(null));
  });
}

function applyMat(group, mat) {
  group.traverse(o => {
    if (o.isMesh) {
      o.material = mat;
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
}

/** FBX を原点中心・地面ゼロに揃える */
function centerOnGround(raw) {
  raw.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(raw);
  const c   = box.getCenter(new THREE.Vector3());
  raw.position.set(-c.x, -box.min.y, -c.z);
}

/**
 * バウンディングボックスの中心から離れすぎたメッシュを除去する
 * ratio: 短辺の何倍以内なら残すか（0〜1）
 */
function trimOutliers(raw, ratio) {
  raw.updateMatrixWorld(true);
  const box  = new THREE.Box3().setFromObject(raw);
  const cen  = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const r    = Math.min(size.x, size.z) * ratio;
  const doomed = [];
  raw.traverse(o => {
    if (!o.isMesh) return;
    const wp = new THREE.Vector3();
    o.getWorldPosition(wp);
    const dx = wp.x - cen.x, dz = wp.z - cen.z;
    if (Math.sqrt(dx * dx + dz * dz) > r) doomed.push(o);
  });
  doomed.forEach(o => o.removeFromParent());
}

function buildFBXCity() {
  // バリエーション混在: 塔=Dark、壁=Brown、構造=Old → 石造りの色彩が豊か
  const matTower  = makeMat('Castle_Towers_',     VARIATIONS.dark);
  const matWall   = makeMat('Castle_Walls_',      VARIATIONS.brown);
  const matStruct = makeMat('Castle_Structures_', VARIATIONS.old);

  // RenderCrate-Castles.fbx = 組み立て済み城シーン
  loadFbx('/3Dobject_data/castle/RenderCrate-Castles.fbx').then(raw => {
    if (!raw) { addFallbackCenter(); return; }

    raw.scale.setScalar(0.013);
    raw.updateMatrixWorld(true);

    // メッシュ名 / マテリアル名でテクスチャを自動選択
    raw.traverse(o => {
      if (!o.isMesh) return;
      const matName = Array.isArray(o.material)
        ? o.material.map(m => m.name).join(' ')
        : (o.material?.name || '');
      const n = (matName + ' ' + o.name).toLowerCase();
      o.material = n.includes('tower') ? matTower
                 : n.includes('wall')  ? matWall
                 : matStruct;
      o.castShadow    = false;
      o.receiveShadow = false;
    });

    // 外れ値部品を除去（コメントアウト中：デバッグ時は有効化）
    // trimOutliers(raw, 0.45);
    raw.updateMatrixWorld(true);
    centerOnGround(raw);

    const grp = new THREE.Group();
    grp.add(raw);
    // 横並び城群をそのまま正面パノラマとして配置
    grp.position.set(-20, 0, -28);
    scene.add(grp);
    console.log('[Town] Castles.fbx loaded');
  });
}

function addFallbackCenter() {
  const mat = new THREE.MeshLambertMaterial({ color: 0x5a4880 });
  [[0, 28, 10], [-15, 40, 6], [15, 40, 6], [0, 50, 4]].forEach(([x, h, w]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w * 3, h, w * 3), mat);
    m.position.set(x, h / 2, -58);
    scene.add(m);
  });
}

/* ── 松明 & PointLight ─────────────────────────────────────────── */
function buildTorches() {
  for (const x of TORCH_X) {
    const light = new THREE.PointLight(0xff9040, 60.0, 120);
    light.position.set(x, 3.5, TORCH_Z);
    scene.add(light);
    torchLights.push({ light, baseInt: 60.0 });

    // 柄 (Cylinder)
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.13, 0.9, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a1e08 })
    );
    pole.position.set(x, 2.7, TORCH_Z);
    scene.add(pole);

    // 炎コア（球）
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff9930 })
    );
    flame.position.set(x, 3.4, TORCH_Z);
    scene.add(flame);

    // 炎ハロー（大きめ・半透明・加算合成）
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff5500, transparent: true, opacity: 0.25,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    halo.position.set(x, 3.5, TORCH_Z);
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
    pos[i * 3 + 2] = TORCH_Z + (Math.random() - 0.5) * 2;
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
        p[i * 3 + 2] = -5 + (Math.random() - 0.5) * 2;
      }
    }
    em.pts.geometry.attributes.position.needsUpdate = true;
  }

  // カメラ超低速ドリフト（遠近感のある揺れ）
  camera.position.x = Math.sin(t * 0.025) * 3.0;
  camera.position.y = 10 + Math.sin(t * 0.018) * 0.5;
  camera.lookAt(Math.sin(t * 0.015) * 4, 5, -40);

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
