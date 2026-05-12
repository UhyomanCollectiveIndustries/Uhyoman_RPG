// ============================================================
// js/ui/locationBackground.js — ロケーション別 Three.js FBX 背景
// ============================================================
//
// このファイルの役割：
//   城・酒場・神殿・ショップの 4 つのロケーション画面に
//   Three.js による 3D FBX 背景を提供します。
//
//   townBackground.js と同様の構造ですが、以下の点が異なります：
//   - 4 つのロケーションが 1 ファイルに集約されている
//   - CONFIGS オブジェクトで各ロケーションの設定を管理
//   - FBX_CACHE で同じ FBX ファイルを複数ロケーションで共有
//   - INSTANCES でシングルトン管理（同じロケーションは 1 回だけ初期化）
//
// ロケーション別の雰囲気：
//   castle: 暗青色・冷たい月明かり
//   tavern: 暖褐色・暖かい灯り    
//   temple: 淡青色・清廉な白光    
//   shop:   暗褐色・くすんだ灯り  
//
// エクスポート：
//   initLocationBackground(locationId) → { start(), stop() }
//   locationId = 'castle' | 'tavern' | 'temple' | 'shop'
// ============================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

/* ── テクスチャキャッシュ ──────────────────────────────────────── */
// TEX    : TextureLoader — PNG/JPG テクスチャを GPU にアップロードする
// TCACHE : Map — URL ごとにテクスチャを 1 回だけロードするためのキャッシュ
const TEX    = new THREE.TextureLoader();
const TCACHE = new Map();
const MAPS   = '/3Dobject_data/castle/maps/'; // PBR テクスチャの基本パス

// 4 種類のレンガテクスチャバリエーションのフォルダ名
const VAR = {
  dark:  'Variation-Dark_Bricks',  // 城に使用（重厚な暗い石）
  brown: 'Variation-Brown_Bricks', // 酒場に使用（温かみのある茶色）
  old:   'Variation-Old_Bricks',   // 店に使用（古びた石）
  light: 'Variation_Light_Bricks', // 神殿に使用（明るい石）
};

/**
 * テクスチャをキャッシュ付きで読み込む。
 * @param {string}  url  - テクスチャ URL
 * @param {boolean} srgb - true = sRGB 空間（色）、false = 線形空間（法線・粗さ等）
 * @returns {THREE.Texture}
 */
function getTex(url, srgb = true) {
  if (!TCACHE.has(url)) {
    const t = TEX.load(url);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
    TCACHE.set(url, t);
  }
  return TCACHE.get(url);
}

/**
 * ロケーション用 PBR マテリアルを生成する。
 * VAR[varKey] からテクスチャフォルダを選び、prefix でファイル名を特定する。
 * @param {string} varKey - 'dark'|'brown'|'old'|'light'
 * @param {string} prefix - ファイル名前部分（例: 'Castle_Towers_'）
 * @returns {THREE.MeshStandardMaterial}
 */
function makeMat(varKey, prefix) {
  const base = `${MAPS}${VAR[varKey]}/`; // 例: /3Dobject_data/castle/maps/Variation-Dark_Bricks/
  return new THREE.MeshStandardMaterial({
    map:          getTex(base + prefix + 'BaseColor.png'),           // ベースカラー
    normalMap:    getTex(base + prefix + 'Normal.png',             false), // 法線
    roughnessMap: getTex(base + prefix + 'Roughness.png',          false), // 粗さ
    aoMap:        getTex(base + prefix + 'Ambient_Occlusion.png',  false), // AO
    metalnessMap: getTex(base + prefix + 'Metallic.png',           false), // 金属度
    roughness: 0.85,
    metalness: 0.05,
  });
}

/* ── ロケーション設定 ──────────────────────────────────────────── */
// 各ロケーションの 3D シーン設定を一元管理するオブジェクト。
// fbx    : 読み込む FBX ファイルのパス
// scale  : FBX のスケール係数（FBX は巨大なので縮小する）
// varKey : テクスチャバリエーションのキー
// prefix : テクスチャファイル名の前部分
// cam    : カメラ位置 [x, y, z]
// look   : カメラの注視点 [x, y, z]
// bg     : 背景色（霧の色と同じにして地平線を自然に）
// fog    : 霧の濃さ係数（大きいほど濃い）
// lights : ライト設定の配列
//   t:'a' = AmbientLight（環境光）
//   t:'d' = DirectionalLight（平行光）p: 位置
//   t:'p' = PointLight（点光源）p: 位置
const CONFIGS = {
  castle: {
    // Castle_Towers.fbx：塔のみを切り出したモデル → 城の玉座間
    fbx:    '/3Dobject_data/castle/RenderCrate-Castle_Towers.fbx',
    scale:  0.030,
    varKey: 'dark',           // 重厚な暗い石造り
    prefix: 'Castle_Towers_',
    cam:    [0, 14, 32],      // やや高い位置から見下ろす
    look:   [0,  8,  0],
    bg:     0x040210,         // 非常に暗い青紫
    fog:    0.006,            // 薄い霧（奥が少し霞む程度）
    lights: [
      { t:'a', c:0x283060, i:2.5 },                   // 冷たい青い環境光
      { t:'d', c:0x6080d0, i:2.5, p:[-20, 40, 20] },  // 月光（左上）
      { t:'d', c:0xff5020, i:0.8, p:[ 30,  8, 30] },  // 微弱な松明の暖色（右手前）
    ],
  },
  tavern: {
    // Castle_Components.fbx：小物・構造物の詰め合わせ → 酒場の内装
    fbx:    '/3Dobject_data/castle/RenderCrate-Castle_Components.fbx',
    scale:  0.040,
    varKey: 'brown',          // 温かみのある茶色い石
    prefix: 'Castle_Structures_',
    cam:    [0, 6, 22],       // 低い位置（人の目線）
    look:   [0, 3,  0],
    bg:     0x0a0503,         // 暖色寄りの暗褐色
    fog:    0.010,            // やや濃い霧（煙った感じ）
    lights: [
      { t:'a', c:0x503020, i:3.0 },                  // 暖色の環境光
      { t:'d', c:0xff8030, i:2.5, p:[15, 20, 20] },  // 暖かい黄橙色の主光源
      { t:'p', c:0xff6010, i:10,  p:[ 0,  5,  5] },  // 近くの PointLight（炉か松明）
    ],
  },
  temple: {
    // Castle_Walls.fbx：壁パーツ → 神聖な神殿の壁
    fbx:    '/3Dobject_data/castle/RenderCrate-Castle_Walls.fbx',
    scale:  0.030,
    varKey: 'light',          // 明るい石（清廉さを表現）
    prefix: 'Castle_Walls_',
    cam:    [0,  9, 28],
    look:   [0,  5,  0],
    bg:     0x040608,         // 暗い青緑（神秘的）
    fog:    0.007,
    lights: [
      { t:'a', c:0x304070, i:3.5 },                   // 冷たい青の環境光
      { t:'d', c:0xd0e0ff, i:3.0, p:[  0, 50, 30] },  // 真上からの白い光（神聖）
      { t:'d', c:0x8090e0, i:1.5, p:[-30, 20, 20] },  // 補助の青白い光
    ],
  },
  shop: {
    // Castle_Components.fbx：tavern と同じ FBX → 商店の内装
    // FBX_CACHE により、既にロード済みのデータが再利用される
    fbx:    '/3Dobject_data/castle/RenderCrate-Castle_Components.fbx',
    scale:  0.040,
    varKey: 'old',            // 古びた石（くたびれた店）
    prefix: 'Castle_Structures_',
    cam:    [0, 6, 22],
    look:   [0, 3,  0],
    bg:     0x080402,         // 非常に暗い褐色
    fog:    0.012,            // 濃い霧（薄暗い店内）
    lights: [
      { t:'a', c:0x402818, i:2.5 },                  // くすんだ暖色の環境光
      { t:'d', c:0xff9040, i:2.0, p:[15, 25, 25] },  // 暖色の主光源
      { t:'p', c:0xff7010, i:8,   p:[ 5,  5,  5] },  // 近くの点光源（ランプ）
    ],
  },
};

/* ── FBX キャッシュ ────────────────────────────────────────────── */
// FBX_CACHE：同じ URL の FBX を複数ロケーションで共有するキャッシュ。
// tavern と shop は同じ FBX ファイルを使うため、1 回のロードで済む。
// Map の値は Promise なので、ロード中でも複数箇所から await できる。
const FBX_CACHE = new Map(); // url → Promise<THREE.Group|null>

/**
 * FBX ファイルを読み込む。キャッシュがあればそれを返す。
 * @param {string} url - FBX ファイルの URL
 * @returns {Promise<THREE.Group|null>}
 */
function loadFbx(url) {
  if (!FBX_CACHE.has(url)) {
    // Promise を Map に保存してから返す（並行ロードを防ぐ）
    const p = new Promise(resolve => {
      new FBXLoader().load(url, resolve, undefined, () => resolve(null));
    });
    FBX_CACHE.set(url, p);
  }
  return FBX_CACHE.get(url);
}

/* ── インスタンスキャッシュ ────────────────────────────────────── */
// INSTANCES：ロケーションID → { start(), stop() } のシングルトン管理。
// 同じロケーションの背景を 2 回以上初期化することを防ぐ。
const INSTANCES = new Map();

/**
 * ロケーション背景を初期化して { start, stop } を返す。
 * 2 回目以降の呼び出しではキャッシュされたインスタンスを返す。
 *
 * @param {string} locationId - 'castle'|'tavern'|'temple'|'shop'
 * @returns {{ start: Function, stop: Function } | null}
 */
export function initLocationBackground(locationId) {
  // 既に初期化済みならキャッシュを返す（WebGLRenderer の重複作成を防ぐ）
  if (INSTANCES.has(locationId)) return INSTANCES.get(locationId);

  // HTML の <canvas id="bg-canvas-castle"> 等を取得
  const canvas = document.getElementById(`bg-canvas-${locationId}`);
  if (!canvas) return null;
  const cfg = CONFIGS[locationId];
  if (!cfg) return null;

  /* ── WebGLRenderer ──────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping         = THREE.ACESFilmicToneMapping; // 映画的トーンマッピング
  renderer.toneMappingExposure = 1.8; // 明るさスケール

  /* ── Scene ──────────────────────────────────────────────── */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(cfg.bg);
  scene.fog = new THREE.FogExp2(cfg.bg, cfg.fog); // 背景色と同じ霧で地平線を消す

  /* ── Camera ─────────────────────────────────────────────── */
  const [cx, cy, cz] = cfg.cam;  // 分割代入でカメラ位置を取得
  const [lx, ly, lz] = cfg.look; // 分割代入で注視点を取得
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(cx, cy, cz);
  camera.lookAt(lx, ly, lz);

  /* ── Lights ─────────────────────────────────────────────── */
  // CONFIGS.lights の配列を順番に処理してシーンに追加する
  for (const l of cfg.lights) {
    if (l.t === 'a') {
      // AmbientLight：空間全体を均一に照らす（影なし）
      scene.add(new THREE.AmbientLight(l.c, l.i));
    } else if (l.t === 'd') {
      // DirectionalLight：方向付き平行光（太陽・月光のシミュレーション）
      const d = new THREE.DirectionalLight(l.c, l.i);
      d.position.set(...l.p); // スプレッド構文で [x,y,z] → (x, y, z)
      scene.add(d);
    } else if (l.t === 'p') {
      // PointLight：点光源（ランプ・松明・ろうそく）
      // 第3引数: 減衰距離, 第4引数: 減衰係数 (2=物理的な逆二乗則)
      const p = new THREE.PointLight(l.c, l.i, 80, 2);
      p.position.set(...l.p);
      scene.add(p);
    }
  }

  /* ── 地面 ───────────────────────────────────────────────── */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ color: cfg.bg }) // 背景色と同じ色で見えにくく
  );
  floor.rotation.x = -Math.PI / 2; // 水平に寝かせる
  scene.add(floor);

  /* ── マテリアル生成 ─────────────────────────────────────── */
  // このロケーション用の PBR マテリアルを 1 つ生成し、全メッシュで共有する
  const mat = makeMat(cfg.varKey, cfg.prefix);

  /* ── FBX 読み込み ───────────────────────────────────────── */
  loadFbx(cfg.fbx).then(source => {
    if (!source) {
      // 読み込み失敗時はフォールバックのプロシージャル城を表示
      addFallback(scene);
    } else {
      // source.clone(true) = FBX グループを deep コピー（FBX_CACHE の元を汚染しない）
      const fbx = source.clone(true);
      fbx.scale.setScalar(cfg.scale); // 縮小（FBX は元サイズが大きすぎる）
      fbx.traverse(child => {
        if (child.isMesh) child.material = mat; // 全メッシュに PBR マテリアルを適用
      });

      // バウンディングボックスで中心を計算して地面 y=0 に合わせる
      const box = new THREE.Box3().setFromObject(fbx);
      const c   = box.getCenter(new THREE.Vector3());
      fbx.position.set(-c.x, -box.min.y, -c.z); // 中心を原点、底辺を y=0 に
      scene.add(fbx);
    }
    // ローディング表示（#loading-castle 等）を隠す
    const ld = document.getElementById(`loading-${locationId}`);
    if (ld) ld.style.display = 'none';
  });

  /* ── リサイズハンドラ ───────────────────────────────────── */
  const onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h; // アスペクト比を更新
    camera.updateProjectionMatrix(); // 変更を反映
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  /* ── アニメーションループ ───────────────────────────────── */
  const clock  = new THREE.Clock(); // このインスタンス専用の時計
  let   animId = null;              // null = 停止中

  function animate() {
    animId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    // カメラを sin 関数でゆっくり揺らす（低速ドリフト）
    // cx から左右に最大 3 単位、cy から上下に最大 1.5 単位
    camera.position.x = cx + Math.sin(t * 0.04)  * 3;
    camera.position.y = cy + Math.sin(t * 0.028) * 1.5;
    camera.lookAt(lx, ly, lz); // 注視点は固定
    renderer.render(scene, camera);
  }

  /* ── start/stop インターフェース ────────────────────────── */
  const inst = {
    /**
     * アニメーションループを開始する。
     * 既に動作中の場合は再開始しない（animId チェック）。
     * onResize() を呼んでキャンバスサイズも更新する。
     */
    start() {
      if (!animId) {
        clock.start();
        animate();
      }
      onResize(); // 画面サイズに合わせてキャンバスをリサイズ
    },
    /**
     * アニメーションループを停止する。
     * animId を null に戻すことで次回 start() が正常に動作する。
     */
    stop() {
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    },
  };

  INSTANCES.set(locationId, inst); // シングルトンとして保存
  return inst;
}

/* ── フォールバック ─────────────────────────────────────────────── */
/**
 * FBX 読み込み失敗時に表示する簡易プロシージャル城シルエット。
 * BoxGeometry を組み合わせて城の輪郭を近似する。
 * @param {THREE.Scene} scene - 追加先のシーン
 */
function addFallback(scene) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x3a2e50 }); // 暗い紫
  // [x, y, z, 幅, 高さ, 奥行き] の配列でボックスを生成
  for (const [x, y, z, w, h, d] of [
    [  0, 12, -22, 10, 24, 10], // 中央の主塔
    [-14,  8, -20,  6, 16,  6], // 左の塔
    [ 14,  8, -20,  6, 16,  6], // 右の塔
    [ -6,  5, -14,  8, 10,  6], // 左前の建屋
    [  6,  5, -14,  8, 10,  6], // 右前の建屋
  ]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat.clone());
    m.position.set(x, y, z);
    scene.add(m);
  }
}
