// ============================================================
// js/ui/townBackground.js — Three.js 3D 町背景
// ============================================================
//
// このファイルの役割：
//   タウン（町）画面の背景を Three.js で 3D レンダリングします。
//   65MB の FBX 城モデル（RenderCrate-Castles.fbx）を読み込み、
//   PBR テクスチャ・照明・星空・松明・火の粉パーティクルで
//   ファンタジー風の夜景を演出します。
//
// 主要な機能：
//   1. FBX 城モデルの読み込みと PBR マテリアル割り当て
//   2. 2000 個の星フィールド（BufferGeometry + Points）
//   3. 5 本の松明（PointLight + 炎球体 + ハロー球体）
//   4. 120 個の火の粉パーティクル（毎フレーム上昇・リセット）
//   5. カメラの低速ドリフト（sin 関数によるゆっくりした揺れ）
//
// PBR テクスチャのバリエーション（4 種類）：
//   dark  = Variation-Dark_Bricks  → 塔に使用
//   brown = Variation-Brown_Bricks → 壁に使用
//   old   = Variation-Old_Bricks   → 構造物に使用
//   light = Variation_Light_Bricks → 未使用（予備）
//
// エクスポート：
//   initTownBackground() → { start(), stop() } を返す
//   start() : アニメーションループ開始
//   stop()  : アニメーションループ停止
// ============================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// ── モジュール変数 ────────────────────────────────────────────
let renderer, scene, camera, animId; // Three.js 基本オブジェクト
let torchLights   = []; // 松明の PointLight を格納する配列（フリッカー計算に使う）
let emberSystems  = []; // 火の粉パーティクルシステムを格納する配列
let clock = new THREE.Clock(); // アニメーション時間計測（経過秒を取得）

/* ── テクスチャユーティリティ ──────────────────────────────────── */
// TextureLoader：PNG/JPG テクスチャを GPU にアップロードするクラス
const TEX_LOADER = new THREE.TextureLoader();
// Map：同じ URL のテクスチャを二重ロードしないためのキャッシュ（URL → Texture オブジェクト）
const TEX_CACHE  = new Map();

// PBR テクスチャの 4 バリエーションパス（フォルダ名のみ）
const VARIATIONS = {
  dark:  '/3Dobject_data/castle/maps/Variation-Dark_Bricks/',
  brown: '/3Dobject_data/castle/maps/Variation-Brown_Bricks/',
  old:   '/3Dobject_data/castle/maps/Variation-Old_Bricks/',
  light: '/3Dobject_data/castle/maps/Variation_Light_Bricks/',
};

/**
 * テクスチャを URL から読み込み、キャッシュに保存して返す。
 * 同じ URL は 2 回目以降キャッシュから返すため、読み込みが 1 回で済む。
 * @param {string}  url  - テクスチャファイルの URL
 * @param {boolean} srgb - true = sRGB 空間（BaseColor など）、false = 線形空間（法線・粗さなど）
 * @returns {THREE.Texture}
 */
function getTex(url, srgb = true) {
  if (!TEX_CACHE.has(url)) {
    const t = TEX_LOADER.load(url);
    // colorSpace：色空間の設定。BaseColor は sRGB、法線・粗さなどは LinearSRGB。
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
    TEX_CACHE.set(url, t);
  }
  return TEX_CACHE.get(url);
}

/**
 * PBR マテリアルを生成する。
 * MeshStandardMaterial は物理ベースレンダリング（PBR）を行うマテリアル。
 * 5 枚のテクスチャマップ（BaseColor, Normal, Roughness, AO, Metallic）を設定する。
 * @param {string} prefix - ファイル名の前部分（例: 'Castle_Towers_'）
 * @param {string} base   - テクスチャフォルダのベース URL（VARIATIONS の値）
 * @returns {THREE.MeshStandardMaterial}
 */
function makeMat(prefix, base) {
  return new THREE.MeshStandardMaterial({
    map:          getTex(base + prefix + 'BaseColor.png'),           // ベースカラー（色）
    normalMap:    getTex(base + prefix + 'Normal.png',            false), // 法線マップ（凹凸）
    roughnessMap: getTex(base + prefix + 'Roughness.png',         false), // 粗さ（光沢）
    aoMap:        getTex(base + prefix + 'Ambient_Occlusion.png', false), // 遮蔽（影の濃さ）
    metalnessMap: getTex(base + prefix + 'Metallic.png',          false), // 金属度
    roughness: 0.80, // デフォルト粗さ（マップに上書きされる）
    metalness: 0.05, // デフォルト金属度
  });
}

// ── 松明の X 座標（5 本分） ──────────────────────────────────
// プレイヤー手前の位置に並べる
const TORCH_X = [-30, -15, 0, 15, 30];
const TORCH_Z = 5;  // カメラ手前に移動して近くに見せる

/**
 * 町背景の Three.js シーンを初期化する。
 * <canvas id="town-bg-canvas"> に描画する。
 * @returns {{ start: Function, stop: Function } | null}
 */
export function initTownBackground() {
  const canvas = document.getElementById('town-bg-canvas');
  if (!canvas) return null;

  // ── WebGLRenderer ──────────────────────────────────────────
  // antialias: false → 軽量化（星・炎は小さいのでジャギーが目立たない）
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // 最大 1.5 倍に制限
  renderer.setSize(window.innerWidth, window.innerHeight);
  // ACESFilmic：映画で使われるトーンマッピング。ハイライトを自然に圧縮する
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2.2; // 明るさスケール（1.0 = 標準）

  // ── Scene ────────────────────────────────────────────────────
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0825); // 深い紫がかった夜色
  // FogExp2：指数的に濃くなる霧。遠くの城が靄に消えるような雰囲気を作る
  // 0.008 は霧の濃さ係数（大きいほど早く霧に消える）
  scene.fog = new THREE.FogExp2(0x0d0825, 0.008);

  // ── Camera ───────────────────────────────────────────────────
  // PerspectiveCamera(視野角, アスペクト比, 近クリップ, 遠クリップ)
  camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 10, 55);  // 高さ 10、手前 55 の位置から
  camera.lookAt(0, 5, -40);        // 城の方向（奥深く）を見る

  // ── Lighting ─────────────────────────────────────────────────
  // AmbientLight：全体を均一に照らす環境光（月明かりの青みがかった色）
  scene.add(new THREE.AmbientLight(0x5060a0, 5.0));

  // DirectionalLight：方向付き平行光源（太陽や月のような遠い光源をシミュレート）
  const moonLight = new THREE.DirectionalLight(0x8090d0, 5.0); // 月光（青白）
  moonLight.position.set(-80, 100, 30); // 左斜め上後方から照らす
  scene.add(moonLight);

  const fillLight = new THREE.DirectionalLight(0x6080c8, 2.5); // 正面補助ライト
  fillLight.position.set(0, 30, 60);    // カメラ側（手前）から照らす
  scene.add(fillLight);

  const topLight = new THREE.DirectionalLight(0x4050a8, 2.0);  // 上部補助ライト
  topLight.position.set(0, 60, 0);       // 真上から照らす
  scene.add(topLight);

  // ── コンテンツ構築 ────────────────────────────────────────────
  buildStars();     // 星空フィールドを生成
  buildGround();    // 地面の平面を生成
  buildFBXCity();   // FBX 城モデルを非同期で読み込む
  buildTorches();   // 松明（柄 + 炎 + 点光源）を生成
  buildEmbers();    // 火の粉パーティクルシステムを生成

  window.addEventListener('resize', onResize);
  return { start, stop };
}

/* ── 星フィールド ─────────────────────────────────────────────── */
/**
 * 2000 個の星を球殻状に配置するパーティクルシステムを生成する。
 * BufferGeometry + Float32Array で GPU に直接頂点データを渡す高速な実装。
 */
function buildStars() {
  const count = 2000;
  // Float32Array：JavaScript の通常の配列よりメモリ効率が良い型付き配列
  // 1 つの星 = [x, y, z] の 3 要素 → count * 3 個
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // 球面上にランダムに点を配置する数学的手法：
    //   theta = 水平角（0〜360°）
    //   phi   = 仰角（sin で変換することで球面上に均一分布）
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1); // 均一な球面分布
    const r     = 180 + Math.random() * 60;          // 半径 180〜240
    pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta); // X
    pos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 5;     // Y（abs で地面以下は出ない）
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta); // Z
  }
  // BufferGeometry：頂点データを直接 GPU バッファに格納する高性能ジオメトリ
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); // 3要素ずつ位置として登録
  // PointsMaterial：点群（パーティクル）用マテリアル
  const mat = new THREE.PointsMaterial({
    color: 0xe8dfd8,         // 薄いベージュ（暖かみのある星の色）
    size: 0.35,              // 点のサイズ（世界座標単位）
    sizeAttenuation: true,   // 遠くの星は小さく見える（遠近感）
    transparent: true,
    opacity: 0.95,
  });
  // Points：BufferGeometry の頂点を点として描画するオブジェクト
  scene.add(new THREE.Points(geo, mat));
}

/* ── 地面 ─────────────────────────────────────────────────────── */
/**
 * 地面となる大きな平面を生成する。
 */
function buildGround() {
  const mat = new THREE.MeshLambertMaterial({ color: 0x0c0810 }); // 暗い紫
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), mat);
  mesh.rotation.x = -Math.PI / 2; // 水平に寝かせる（デフォルトは垂直）
  mesh.position.y = 0;
  scene.add(mesh);
}

/* ── FBX 城モデル読み込みユーティリティ ───────────────────────── */
/**
 * FBX ファイルを Promise でラップして非同期に読み込む。
 * 読み込み失敗時は null を返す（アプリがクラッシュしないようにする）。
 * @param {string} url - FBX ファイルの URL
 * @returns {Promise<THREE.Group|null>}
 */
function loadFbx(url) {
  return new Promise(resolve => {
    // FBXLoader: Three.js の拡張ローダー。FBX 形式を Group（3D オブジェクト）に変換する。
    // 引数: (url, onLoad, onProgress, onError)
    new FBXLoader().load(url, resolve, undefined, () => resolve(null));
  });
}

/**
 * グループ内の全メッシュに同じマテリアルを一括適用する。
 * group.traverse() はグループ内の全オブジェクトを再帰的に訪問する。
 * @param {THREE.Group}   group - FBX 読み込み結果のグループ
 * @param {THREE.Material} mat  - 適用するマテリアル
 */
function applyMat(group, mat) {
  group.traverse(o => {
    if (o.isMesh) {          // メッシュ（面を持つ 3D オブジェクト）のみ処理
      o.material = mat;
      o.castShadow    = false; // 影の計算を省略（軽量化）
      o.receiveShadow = false;
    }
  });
}

/**
 * FBX を原点中心・地面ゼロに揃える。
 * Box3（バウンディングボックス）を使ってモデルの中心を計算し、
 * 地面（y=0）にぴったり設置する。
 * @param {THREE.Group} raw - FBX 読み込み結果のグループ
 */
function centerOnGround(raw) {
  raw.updateMatrixWorld(true); // 子の行列を更新してから Box3 を計算
  const box = new THREE.Box3().setFromObject(raw); // バウンディングボックスを計算
  const c   = box.getCenter(new THREE.Vector3());  // 中心点を取得
  raw.position.set(-c.x, -box.min.y, -c.z);        // 中心を原点、底辺を y=0 に移動
}

/**
 * バウンディングボックスの中心から離れすぎたメッシュを除去する。
 * FBX に含まれる浮いたパーツ（遠方の木・小物など）を削除して
 * パフォーマンスを改善するためのユーティリティ。
 * ※ 現在は buildFBXCity() でコメントアウトされているため呼ばれない。
 * @param {THREE.Group} raw   - FBX グループ
 * @param {number}      ratio - 中心から「短辺×ratio」以内のメッシュだけ残す
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
  doomed.forEach(o => o.removeFromParent()); // 配列に溜めてから削除（traverse 中の変更は危険）
}

/* ── FBX 城モデル ─────────────────────────────────────────────── */
/**
 * FBX 城モデルを読み込み、メッシュ名に応じて 3 種のマテリアルを割り当てる。
 * - 'tower' を含む名前 → Dark Bricks テクスチャ（塔）
 * - 'wall'  を含む名前 → Brown Bricks テクスチャ（壁）
 * - それ以外            → Old Bricks テクスチャ（構造物）
 */
function buildFBXCity() {
  // バリエーション混在: 塔=Dark、壁=Brown、構造=Old → 石造りの色彩が豊か
  const matTower  = makeMat('Castle_Towers_',     VARIATIONS.dark);
  const matWall   = makeMat('Castle_Walls_',      VARIATIONS.brown);
  const matStruct = makeMat('Castle_Structures_', VARIATIONS.old);

  // RenderCrate-Castles.fbx = 組み立て済み城シーン（最も大きい FBX ファイル）
  loadFbx('/3Dobject_data/castle/RenderCrate-Castles.fbx').then(raw => {
    if (!raw) { addFallbackCenter(); return; } // 読み込み失敗時はフォールバック

    raw.scale.setScalar(0.013); // FBX は大きすぎるため縮小（0.013 = 1.3%）
    raw.updateMatrixWorld(true); // スケール変更後に行列を更新

    // メッシュ名 / マテリアル名でテクスチャを自動選択
    raw.traverse(o => {
      if (!o.isMesh) return;
      // マテリアルが配列の場合（複数テクスチャメッシュ）は名前を結合
      const matName = Array.isArray(o.material)
        ? o.material.map(m => m.name).join(' ')
        : (o.material?.name || '');
      const n = (matName + ' ' + o.name).toLowerCase();
      o.material = n.includes('tower') ? matTower  // 塔
                 : n.includes('wall')  ? matWall   // 壁
                 : matStruct;                       // その他（構造物）
      o.castShadow    = false; // 影は無効（パフォーマンス優先）
      o.receiveShadow = false;
    });

    // 外れ値部品を除去（現在はコメントアウト中：デバッグ時に有効化して使う）
    // trimOutliers(raw, 0.45);
    raw.updateMatrixWorld(true);
    centerOnGround(raw); // 地面ゼロ・原点中心に揃える

    const grp = new THREE.Group();
    grp.add(raw);
    // 横並び城群をそのまま正面パノラマとして配置（少し左・奥に移動）
    grp.position.set(-20, 0, -28);
    scene.add(grp);
    console.log('[Town] Castles.fbx loaded');
  });
}

/**
 * FBX 読み込み失敗時に表示する簡易プロシージャル城シルエット。
 * BoxGeometry を積み重ねて城塔らしく見せる。
 */
function addFallbackCenter() {
  const mat = new THREE.MeshLambertMaterial({ color: 0x5a4880 }); // 紫がかった石色
  // [x, 高さ, 幅] の配列で簡易的な塔を生成
  [[0, 28, 10], [-15, 40, 6], [15, 40, 6], [0, 50, 4]].forEach(([x, h, w]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w * 3, h, w * 3), mat);
    m.position.set(x, h / 2, -58);
    scene.add(m);
  });
}

/* ── 松明 & PointLight ─────────────────────────────────────────── */
/**
 * 5 本の松明を生成する。各松明は 3 つのオブジェクトで構成される：
 *   1. PointLight（点光源）  → 炎の明かりを周囲に広げる
 *   2. CylinderGeometry（柄）→ 木の棒
 *   3. SphereGeometry（炎コア）→ 燃えている部分
 *   4. SphereGeometry（ハロー）→ 炎のグロー効果（半透明・加算合成）
 * 点光源は torchLights 配列に保存し、animate() でフリッカー（揺らぎ）を与える。
 */
function buildTorches() {
  for (const x of TORCH_X) {
    // PointLight：指定範囲内を照らす点光源（ろうそく・松明に適した）
    // 引数：(色, 強度, 減衰距離)
    const light = new THREE.PointLight(0xff9040, 60.0, 120);
    light.position.set(x, 3.5, TORCH_Z);
    scene.add(light);
    torchLights.push({ light, baseInt: 60.0 }); // baseInt = フリッカー計算の基準強度

    // 柄（細い円柱）
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.13, 0.9, 6), // 上細・下太の 6 角柱
      new THREE.MeshLambertMaterial({ color: 0x3a1e08 }) // こげ茶
    );
    pole.position.set(x, 2.7, TORCH_Z);
    scene.add(pole);

    // 炎コア（小さな球体 → 燃えている中心）
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff9930 }) // 橙色（ライティング無視）
    );
    flame.position.set(x, 3.4, TORCH_Z);
    scene.add(flame);

    // 炎ハロー（大きめ・半透明・加算合成）
    // AdditiveBlending：後ろの色に足し算で重ねる → グロー（発光）効果
    // depthWrite: false → 奥行きバッファに書き込まない（他のオブジェクトを隠さない）
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
/**
 * 松明から立ち昇る火の粉パーティクルシステムを生成する。
 * 120 個の粒を 5 本の松明の近くに分散配置し、animate() で
 * 毎フレーム上昇・左右ドリフトさせてループする。
 */
function buildEmbers() {
  const count = 120;
  // Float32Array で粒の初期位置を設定
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const tx = TORCH_X[i % TORCH_X.length]; // 松明を順番に割り当て
    pos[i * 3]     = tx + (Math.random() - 0.5) * 4; // 松明付近にランダム散布
    pos[i * 3 + 1] = 3 + Math.random() * 10;          // 高さ 3〜13
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
  // emberSystems に保存 → animate() で位置を毎フレーム更新する
  emberSystems.push({ pts, pos, count });
}

/* ── リサイズ ────────────────────────────────────────────────── */
/**
 * ウィンドウサイズ変更時にカメラとレンダラーを更新する。
 * カメラの aspect（アスペクト比）を更新しないと映像が歪む。
 */
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix(); // aspect 変更後に必ず呼ぶ
  renderer.setSize(w, h);
}

/* ── アニメーションループ ────────────────────────────────────── */
/**
 * 毎フレーム呼ばれるアニメーション更新関数。
 * requestAnimationFrame で自分自身を再帰的に呼んでループする。
 * 処理内容：
 *   1. 松明フリッカー   : sin 波を重ねて自然な炎の揺らぎを表現
 *   2. 火の粉上昇      : Y 座標を毎フレーム増やし、上限超えたらリセット
 *   3. カメラドリフト   : sin 関数で超低速な水平・垂直の揺れ
 */
function animate() {
  animId = requestAnimationFrame(animate); // 次フレームに自分を登録
  const t = clock.getElapsedTime();        // 経過秒数（起動からの合計）

  // 松明フリッカー：2 つの sin 波を合成して不規則な炎の揺らぎを作る
  // sin(t * 8.3) → 速い揺れ（0.7 倍で振幅を抑える）
  // sin(t * 15.1) → より速い揺れ（0.3 倍で弱く）
  for (const { light, baseInt } of torchLights) {
    light.intensity = baseInt
      + Math.sin(t * 8.3  + light.position.x) * 0.7
      + Math.sin(t * 15.1 + light.position.x * 0.5) * 0.3;
  }

  // 火の粉上昇
  for (const em of emberSystems) {
    const p = em.pts.geometry.attributes.position.array;
    for (let i = 0; i < em.count; i++) {
      p[i * 3 + 1] += 0.014; // Y（高さ）を毎フレーム増やす
      // X（横）を sin で左右にランダムドリフト
      p[i * 3] += Math.sin(t * 0.9 + i * 1.3) * 0.004;
      // 高さ 18 を超えたら松明の根元にリセット（ループ）
      if (p[i * 3 + 1] > 18) {
        const tx = TORCH_X[i % TORCH_X.length];
        p[i * 3]     = tx + (Math.random() - 0.5) * 3;
        p[i * 3 + 1] = 3.2;
        p[i * 3 + 2] = -5 + (Math.random() - 0.5) * 2;
      }
    }
    // needsUpdate = true：GPU バッファを再アップロードする（必須）
    em.pts.geometry.attributes.position.needsUpdate = true;
  }

  // カメラ超低速ドリフト（映画的な揺れ）
  // sin(t * 0.025) → 約 40 秒周期でゆっくり左右に動く
  camera.position.x = Math.sin(t * 0.025) * 3.0;
  camera.position.y = 10 + Math.sin(t * 0.018) * 0.5; // わずかに上下
  camera.lookAt(Math.sin(t * 0.015) * 4, 5, -40);      // 注視点も少し左右に動く

  renderer.render(scene, camera); // シーンをキャンバスに描画
}

/* ── start / stop ──────────────────────────────────────────────── */
/**
 * アニメーションループを開始する。
 * initTownBackground() の戻り値 { start, stop } を通じて呼ばれる。
 */
export function start() {
  clock.start(); // 経過時間の計測を開始（フリッカー・ドリフト計算に使う）
  animate();     // ループを開始
}

/**
 * アニメーションループを停止する。
 * 画面を離れたとき（showScreen で別画面に切り替えたとき）に呼ぶ。
 * cancelAnimationFrame で次フレームへの登録をキャンセルする。
 */
export function stop() {
  cancelAnimationFrame(animId); // ループを止める
  clock.stop();                 // 時計も止める
}
