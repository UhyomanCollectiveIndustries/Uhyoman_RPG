// js/ui/locationBackground.js — 各ロケーション用 Three.js FBX 背景
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

/* ── テクスチャキャッシュ ──────────────────────────────────────── */
const TEX    = new THREE.TextureLoader();
const TCACHE = new Map();
const MAPS   = '/3Dobject_data/castle/maps/';

const VAR = {
  dark:  'Variation-Dark_Bricks',
  brown: 'Variation-Brown_Bricks',
  old:   'Variation-Old_Bricks',
  light: 'Variation_Light_Bricks',
};

function getTex(url, srgb = true) {
  if (!TCACHE.has(url)) {
    const t = TEX.load(url);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
    TCACHE.set(url, t);
  }
  return TCACHE.get(url);
}

function makeMat(varKey, prefix) {
  const base = `${MAPS}${VAR[varKey]}/`;
  return new THREE.MeshStandardMaterial({
    map:          getTex(base + prefix + 'BaseColor.png'),
    normalMap:    getTex(base + prefix + 'Normal.png',             false),
    roughnessMap: getTex(base + prefix + 'Roughness.png',          false),
    aoMap:        getTex(base + prefix + 'Ambient_Occlusion.png',  false),
    metalnessMap: getTex(base + prefix + 'Metallic.png',           false),
    roughness: 0.85,
    metalness: 0.05,
  });
}

/* ── ロケーション設定 ──────────────────────────────────────────── */
const CONFIGS = {
  castle: {
    fbx:    '/3Dobject_data/castle/RenderCrate-Castle_Towers.fbx',
    scale:  0.030,
    varKey: 'dark',
    prefix: 'Castle_Towers_',
    cam:    [0, 14, 32],
    look:   [0,  8,  0],
    bg:     0x040210,
    fog:    0.006,
    lights: [
      { t:'a', c:0x283060, i:2.5 },
      { t:'d', c:0x6080d0, i:2.5, p:[-20, 40, 20] },
      { t:'d', c:0xff5020, i:0.8, p:[ 30,  8, 30] },
    ],
  },
  tavern: {
    fbx:    '/3Dobject_data/castle/RenderCrate-Castle_Components.fbx',
    scale:  0.040,
    varKey: 'brown',
    prefix: 'Castle_Structures_',
    cam:    [0, 6, 22],
    look:   [0, 3,  0],
    bg:     0x0a0503,
    fog:    0.010,
    lights: [
      { t:'a', c:0x503020, i:3.0 },
      { t:'d', c:0xff8030, i:2.5, p:[15, 20, 20] },
      { t:'p', c:0xff6010, i:10,  p:[ 0,  5,  5] },
    ],
  },
  temple: {
    fbx:    '/3Dobject_data/castle/RenderCrate-Castle_Walls.fbx',
    scale:  0.030,
    varKey: 'light',
    prefix: 'Castle_Walls_',
    cam:    [0,  9, 28],
    look:   [0,  5,  0],
    bg:     0x040608,
    fog:    0.007,
    lights: [
      { t:'a', c:0x304070, i:3.5 },
      { t:'d', c:0xd0e0ff, i:3.0, p:[  0, 50, 30] },
      { t:'d', c:0x8090e0, i:1.5, p:[-30, 20, 20] },
    ],
  },
  shop: {
    fbx:    '/3Dobject_data/castle/RenderCrate-Castle_Components.fbx',
    scale:  0.040,
    varKey: 'old',
    prefix: 'Castle_Structures_',
    cam:    [0, 6, 22],
    look:   [0, 3,  0],
    bg:     0x080402,
    fog:    0.012,
    lights: [
      { t:'a', c:0x402818, i:2.5 },
      { t:'d', c:0xff9040, i:2.0, p:[15, 25, 25] },
      { t:'p', c:0xff7010, i:8,   p:[ 5,  5,  5] },
    ],
  },
};

/* ── FBX キャッシュ（同 URL は 1 回だけロード） ────────────────── */
const FBX_CACHE = new Map(); // url → Promise<THREE.Group|null>

function loadFbx(url) {
  if (!FBX_CACHE.has(url)) {
    const p = new Promise(resolve => {
      new FBXLoader().load(url, resolve, undefined, () => resolve(null));
    });
    FBX_CACHE.set(url, p);
  }
  return FBX_CACHE.get(url);
}

/* ── インスタンスキャッシュ ────────────────────────────────────── */
const INSTANCES = new Map();

export function initLocationBackground(locationId) {
  if (INSTANCES.has(locationId)) return INSTANCES.get(locationId);

  const canvas = document.getElementById(`bg-canvas-${locationId}`);
  if (!canvas) return null;
  const cfg = CONFIGS[locationId];
  if (!cfg) return null;

  /* renderer */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping        = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.8;

  /* scene */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(cfg.bg);
  scene.fog = new THREE.FogExp2(cfg.bg, cfg.fog);

  /* camera */
  const [cx, cy, cz] = cfg.cam;
  const [lx, ly, lz] = cfg.look;
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(cx, cy, cz);
  camera.lookAt(lx, ly, lz);

  /* lights */
  for (const l of cfg.lights) {
    if      (l.t === 'a') { scene.add(new THREE.AmbientLight(l.c, l.i)); }
    else if (l.t === 'd') { const d = new THREE.DirectionalLight(l.c, l.i); d.position.set(...l.p); scene.add(d); }
    else if (l.t === 'p') { const p = new THREE.PointLight(l.c, l.i, 80, 2); p.position.set(...l.p); scene.add(p); }
  }

  /* floor */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ color: cfg.bg })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  /* material for this location */
  const mat = makeMat(cfg.varKey, cfg.prefix);

  /* load FBX */
  loadFbx(cfg.fbx).then(source => {
    if (!source) {
      addFallback(scene);
    } else {
      const fbx = source.clone(true);
      fbx.scale.setScalar(cfg.scale);
      fbx.traverse(child => { if (child.isMesh) child.material = mat; });

      // モデルをフロアに合わせて自動センタリング
      const box = new THREE.Box3().setFromObject(fbx);
      const c   = box.getCenter(new THREE.Vector3());
      fbx.position.set(-c.x, -box.min.y, -c.z);
      scene.add(fbx);
    }
    // ローディング表示を隠す
    const ld = document.getElementById(`loading-${locationId}`);
    if (ld) ld.style.display = 'none';
  });

  /* resize */
  const onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  /* animation */
  const clock  = new THREE.Clock();
  let   animId = null;

  function animate() {
    animId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    camera.position.x = cx + Math.sin(t * 0.04) * 3;
    camera.position.y = cy + Math.sin(t * 0.028) * 1.5;
    camera.lookAt(lx, ly, lz);
    renderer.render(scene, camera);
  }

  const inst = {
    start() { if (!animId) { clock.start(); animate(); } onResize(); },
    stop()  { if (animId) { cancelAnimationFrame(animId); animId = null; } },
  };

  INSTANCES.set(locationId, inst);
  return inst;
}

/* フォールバック用ジオメトリ（FBX 読み込み失敗時） */
function addFallback(scene) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x3a2e50 });
  for (const [x, y, z, w, h, d] of [
    [  0, 12, -22, 10, 24, 10],
    [-14,  8, -20,  6, 16,  6],
    [ 14,  8, -20,  6, 16,  6],
    [ -6,  5, -14,  8, 10,  6],
    [  6,  5, -14,  8, 10,  6],
  ]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat.clone());
    m.position.set(x, y, z);
    scene.add(m);
  }
}
