// ============================================================
// js/ui/dungeonUI.js — ダンジョン探索（3D FPS 風 + 1マスずつ移動）
// ============================================================
//
// このファイルの役割：
//   3D ダンジョンの描画・探索ロジックをすべて管理します。
//   Three.js でリアルタイムレンダリングし、キーボード（WASD / 矢印キー）と
//   画面上の仮想ボタンで操作できます。
//
// 全体の流れ：
//   1. initDungeonUI() → show() → startDungeon()
//   2. startDungeon() でマップを読み込み、シーンを構築して animLoop() を開始
//   3. キー入力 → tryMove()/startTurn() でアニメーション変数を設定
//   4. animLoop() の毎フレームでカメラ位置を補間し、着地したら onStepLand()
//   5. onStepLand() でランダムエンカウント(18%)・階段チェックを実行
//   6. hide() → stopDungeon() でアニメーション停止・レンダラー解放
//
// マップ記号（.txt ファイルの定義）：
//   '1' = 壁、'0' = 通路、'S' = スタート地点、'E' = 降り階段、'U' = 上り階段
//
// アニメーション仕組み：
//   _animProgress を毎フレーム増やしてイージング関数で補間する。
//   _animType = 'move' なら位置補間、'turn' なら回転補間。
//   アニメーション中（_moving = true）は新規入力を無視する。
// ============================================================
import * as THREE from 'three';
import { Party, DB, showScreen } from '../gameState.js';
import { startBattle } from '../battle.js';

// ── 定数 ────────────────────────────────────────────────────────
const CELL   = 1;      // 1 マス = Three.js 上の 1 単位
const WALL_H = 1.0;    // 壁の高さ（= 天井の高さ）

// 4 方向の移動ベクトルと名前
// DIRS[0] = 北（Z-）、DIRS[1] = 東（X+）、DIRS[2] = 南（Z+）、DIRS[3] = 西（X-）
const DIRS = [
  { dx: 0,  dz: -1, name: '北' },
  { dx: 1,  dz:  0, name: '東' },
  { dx: 0,  dz:  1, name: '南' },
  { dx: -1, dz:  0, name: '西' },
];

// ── モジュール変数（グローバルに近い状態管理） ──────────────────
let renderer, scene, camera, clock; // Three.js の基本オブジェクト
let _map  = [];     // 2D 配列：_map[z][x] = '0'/'1'/'S'/'E' など
let _rows, _cols;   // マップの行数・列数
let _active = false;   // 画面が表示中かどうか
let _moving = false;   // アニメーション中は true → 入力を無視
let _animTarget = null; // （予約変数・現在未使用）
let _animProgress = 0;  // 0→1 に増加。1になったらアニメーション完了
let _animFrom = null;   // 移動開始時のマス座標 { x, z }
let _animTo   = null;   // 移動目標のマス座標 { x, z }
let _animType = null;   // 'move'（移動）| 'turn'（旋回）
let _animFromYaw = 0;   // 旋回開始時の Y 軸角度（ラジアン）
let _animToYaw   = 0;   // 旋回目標の Y 軸角度（ラジアン）
let _yaw = 0;           // カメラの現在 Y 軸角度（向き）
let _animId;            // requestAnimationFrame の返り値（cancelに使う）

// 照明レベル（0=暗闇 ～ 100=明るい。50以上だと霧の終わり距離が広がる）
let _lightLevel = 50;

// アニメーション速度
const TURN_SPEED = 8;  // ラジアン/秒（旋回スピード）
const MOVE_SPEED = 6;  // セル/秒（移動スピード）

// ============================================================
// 初期化（main.js から一度だけ呼ばれる）
// ============================================================

/**
 * ダンジョン UI を初期化する。
 * キーボードイベント・仮想ボタンのリスナーを登録し、
 * show/hide を持つオブジェクトを返す。
 */
export function initDungeonUI() {
  const el = document.getElementById('screen-dungeon');

  // ── キーボード入力 ────────────────────────────────────────
  // window 全体でキー入力を監視する。
  // _active（ダンジョン表示中）かつ _moving（アニメーション中でない）ときのみ反応する。
  window.addEventListener('keydown', e => {
    if (!_active || _moving) return;
    switch (e.code) {
      case 'ArrowUp':   case 'KeyW': tryMove(0);    break; // 前進
      case 'ArrowDown': case 'KeyS': tryMove(2);    break; // 後退（南方向 = 180°反転）
      case 'ArrowLeft': case 'KeyA': startTurn(-1); break; // 左旋回（-1 = 反時計）
      case 'ArrowRight':case 'KeyD': startTurn(1);  break; // 右旋回（+1 = 時計）
      case 'Escape':                 leaveD();       break; // 町へ戻る
    }
  });

  // ── 仮想ボタン（スマートフォン対応） ────────────────────────
  // HTML 上の #btn-d-* ボタンにタップイベントを登録する。
  // ?. は「要素が存在しない場合は何もしない」という Optional Chaining 記法。
  document.getElementById('btn-d-forward')?.addEventListener('click', () => { if(!_moving) tryMove(0); });
  document.getElementById('btn-d-back')?.addEventListener('click',    () => { if(!_moving) tryMove(2); });
  document.getElementById('btn-d-left')?.addEventListener('click',    () => { if(!_moving) startTurn(-1); });
  document.getElementById('btn-d-right')?.addEventListener('click',   () => { if(!_moving) startTurn(1); });
  document.getElementById('btn-d-exit')?.addEventListener('click',    () => leaveD());

  return {
    show() {
      _active = true;
      el.style.display = 'flex';
      startDungeon(); // Three.js シーン構築＆アニメーション開始
    },
    hide() {
      _active = false;
      el.style.display = 'none';
      stopDungeon(); // Three.js リソースを解放
    },
  };
}

// ============================================================
// ダンジョン起動・停止
// ============================================================

/**
 * ダンジョンを開始する。
 * Party.floor に対応したマップを DB から取得し、Three.js シーンを構築する。
 */
function startDungeon() {
  const floor = Party.floor; // 現在の階数（1〜）
  _map = DB.maps[floor];     // dataLoader.js が解析した 2D マップ配列
  if (!_map) { console.error('No map for floor', floor); return; }
  _rows = _map.length;       // 行数（Z 方向）
  _cols = _map[0].length;    // 列数（X 方向）

  // マップからスタート位置 'S' を探してプレイヤーを配置
  for (let r = 0; r < _rows; r++) {
    for (let c = 0; c < _cols; c++) {
      if (_map[r][c] === 'S') {
        Party.pos = { x: c, z: r }; // スタート座標
        Party.dir = 0;               // 北を向く（dir=0 = 北）
      }
    }
  }

  _yaw = dirToYaw(Party.dir); // dir（0〜3）を Y 軸角度（ラジアン）に変換
  setupRenderer();             // WebGLRenderer を生成
  buildScene();                // カメラ・ライト・マップジオメトリを生成
  clock = new THREE.Clock();   // デルタタイム計測用クロック
  animLoop();                  // アニメーションループ開始
  updateHUD();                 // キャラクター情報・フロア表示を更新
  drawMinimap();               // ミニマップを描画
  setMsg(`B${floor}F に潜入した。出口の階段を探せ！`);
}

/**
 * ダンジョンを停止する。
 * アニメーションループをキャンセルし、WebGLRenderer を解放する。
 */
function stopDungeon() {
  cancelAnimationFrame(_animId); // ループを止める
  renderer?.dispose();           // GPU リソース（VBO, シェーダー等）を解放
  renderer = null;
}

// ========== Three.js ==========
function setupRenderer() {
  const canvas = document.getElementById('dungeon-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
  renderer.setPixelRatio(1);

  window.addEventListener('resize', onResize);
}

function onResize() {
  if (!renderer) return;
  const canvas = document.getElementById('dungeon-canvas');
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  if (camera) { camera.aspect = canvas.clientWidth / canvas.clientHeight; camera.updateProjectionMatrix(); }
}

function buildScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 2, _lightLevel > 50 ? 8 : 3.5);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 20);
  placeCamera();

  // 環境光 (暗め)
  scene.add(new THREE.AmbientLight(0x111111, 1));

  // プレイヤー携帯光源
  const pl = new THREE.PointLight(0xffcc88, 1.5, 4);
  pl.name = 'playerLight';
  camera.add(pl);
  scene.add(camera);

  buildGeometry();
}

function buildGeometry() {
  const wallMat  = new THREE.MeshLambertMaterial({ color: 0x4a3a3a });
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x2a2020 });
  const ceilMat  = new THREE.MeshLambertMaterial({ color: 0x1a1515 });
  const stairMat = new THREE.MeshLambertMaterial({ color: 0xc0a030 });
  const startMat = new THREE.MeshLambertMaterial({ color: 0x306030 });

  // 壁テクスチャ風に石ブロック模様 (手続き)
  for (let r = 0; r < _rows; r++) {
    for (let c = 0; c < _cols; c++) {
      const tile = _map[r][c];
      const wx = c * CELL, wz = r * CELL;

      if (tile === '1') {
        // 壁
        const geo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
        const mesh = new THREE.Mesh(geo, wallMat);
        mesh.position.set(wx + CELL/2, WALL_H/2, wz + CELL/2);
        scene.add(mesh);
      } else {
        // 床
        addPlane(floorMat, wx + CELL/2, 0, wz + CELL/2, -Math.PI/2);
        // 天井
        addPlane(ceilMat,  wx + CELL/2, WALL_H, wz + CELL/2, Math.PI/2);

        if (tile === 'E') {
          // 降り階段
          const s = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.6), stairMat);
          s.position.set(wx + CELL/2, 0.08, wz + CELL/2);
          scene.add(s);
          const sl = new THREE.PointLight(0xffdd44, 2, 3);
          sl.position.set(wx + CELL/2, 0.5, wz + CELL/2);
          scene.add(sl);
        } else if (tile === 'S' || tile === 'U') {
          const s = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.6), startMat);
          s.position.set(wx + CELL/2, 0.05, wz + CELL/2);
          scene.add(s);
        }

        // 松明 (ランダム)
        if (tile === '0' && Math.random() < 0.08) addTorch(wx + CELL/2, wz + CELL/2);
      }
    }
  }
}

function addPlane(mat, x, y, z, rx) {
  const geo = new THREE.PlaneGeometry(CELL, CELL);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  scene.add(m);
}

function addTorch(x, z) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff8822 });
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), mat);
  f.position.set(x, WALL_H - 0.1, z);
  scene.add(f);
  const l = new THREE.PointLight(0xff6600, 1.2, 5);
  l.position.copy(f.position);
  scene.add(l);
}

function placeCamera() {
  if (!camera) return;
  camera.position.set(
    Party.pos.x * CELL + CELL/2,
    WALL_H * 0.55,
    Party.pos.z * CELL + CELL/2
  );
  camera.rotation.order = 'YXZ';
  camera.rotation.y = _yaw;
  camera.rotation.x = 0;
}

function dirToYaw(dir) {
  return [Math.PI, -Math.PI/2, 0, Math.PI/2][dir];
}

// ========== 移動・回転 ==========
function tryMove(relDir) {
  // relDir: 0=前, 2=後
  const faceDir = (Party.dir + relDir) % 4;
  const d = DIRS[faceDir];
  const nx = Party.pos.x + d.dx;
  const nz = Party.pos.z + d.dz;
  if (!canWalk(nx, nz)) {
    setMsg('壁だ！');
    shakeCamera();
    return;
  }
  startMove(nx, nz, relDir === 0);
}

function canWalk(x, z) {
  if (z < 0 || z >= _rows || x < 0 || x >= _cols) return false;
  return _map[z][x] !== '1';
}

function startMove(nx, nz, forward) {
  _moving = true;
  _animType = 'move';
  _animProgress = 0;
  _animFrom = { ...Party.pos };
  _animTo   = { x: nx, z: nz };
}

function startTurn(sign) {
  _moving = true;
  _animType = 'turn';
  _animProgress = 0;
  _animFromYaw = _yaw;
  Party.dir = (Party.dir + 4 + sign) % 4;
  _animToYaw = _yaw + sign * Math.PI/2;
}

function shakeCamera() {
  // 簡易カメラシェイク
  if (!camera) return;
  const orig = camera.position.clone();
  let t = 0;
  const shake = setInterval(() => {
    t++;
    camera.position.x = orig.x + (Math.random()-0.5)*0.04;
    if (t > 6) { camera.position.copy(orig); clearInterval(shake); }
  }, 30);
}

// ========== アニメーションループ ==========
function animLoop() {
  _animId = requestAnimationFrame(animLoop);
  if (!renderer || !scene || !camera) return;
  const dt = clock.getDelta();

  if (_moving) {
    _animProgress += dt * (_animType === 'turn' ? TURN_SPEED : MOVE_SPEED);

    if (_animType === 'move') {
      const t = Math.min(_animProgress, 1);
      const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      camera.position.x = (_animFrom.x + (_animTo.x - _animFrom.x) * ease) * CELL + CELL/2;
      camera.position.z = (_animFrom.z + (_animTo.z - _animFrom.z) * ease) * CELL + CELL/2;
      if (_animProgress >= 1) {
        Party.pos = { ..._animTo };
        placeCamera();
        _moving = false;
        onStepLand();
      }
    } else if (_animType === 'turn') {
      const t = Math.min(_animProgress / (Math.PI/2), 1);
      const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      _yaw = _animFromYaw + (_animToYaw - _animFromYaw) * ease;
      camera.rotation.y = _yaw;
      if (t >= 1) {
        _yaw = _animToYaw;
        camera.rotation.y = _yaw;
        _moving = false;
      }
    }
  }

  renderer.render(scene, camera);
}

function onStepLand() {
  const tile = _map[Party.pos.z]?.[Party.pos.x];
  updateHUD();
  drawMinimap();

  if (tile === 'E') {
    setMsg('【降り階段】 ここから次の階へ…\n[Enter]で降りる');
    document.addEventListener('keydown', function onEnter(e) {
      if (e.code === 'Enter' || e.code === 'Space') {
        document.removeEventListener('keydown', onEnter);
        goNextFloor();
      }
    }, { once: true });
    return;
  }

  // ランダムエンカウント
  if (['0','S','U'].includes(tile) && Math.random() < 0.18) {
    triggerEncounter();
  }
}

function triggerEncounter() {
  const floor = Party.floor;
  // フロアに応じたモンスター
  const table = [
    ['kobold','giant_rat','slime'],
    ['orc','zombie','skeleton'],
    ['skeleton','werewolf','vampire'],
  ];
  const pool = table[Math.min(floor-1, table.length-1)];
  const count = 1 + Math.floor(Math.random() * 3);
  const enemyIds = Array.from({ length: count }, () => pool[Math.floor(Math.random()*pool.length)]);
  setMsg(`モンスターが現れた！ ${enemyIds.map(id => DB.monsters[id]?.name).join(', ')}`);

  setTimeout(() => {
    startBattle(enemyIds, () => {
      showScreen('dungeon');
    });
  }, 800);
}

function goNextFloor() {
  Party.floor++;
  if (!DB.maps[Party.floor]) {
    setMsg('これ以上深くには行けないようだ…');
    Party.floor--;
    return;
  }
  stopDungeon();
  setTimeout(() => { startDungeon(); }, 100);
}

function leaveD() {
  showScreen('town');
}

// ========== HUD / Minimap ==========
function updateHUD() {
  const p = Party.members[0];
  if (!p) return;
  const hudEl = document.getElementById('d-hud-name');
  if (hudEl) hudEl.textContent = `${p.name} Lv.${p.level}`;

  // パーティ全員のHPバー
  const list = document.getElementById('d-party-strip');
  if (!list) return;
  list.innerHTML = '';
  Party.members.forEach((c, i) => {
    const span = document.createElement('div');
    span.className = 'd-party-member';
    span.innerHTML = `<span>${c.name}</span><div class="bar-bg sm"><div class="bar hp-bar" style="width:${Math.max(0,c.hp/c.maxHp*100)}%"></div></div>`;
    list.appendChild(span);
  });

  // フロア
  const flEl = document.getElementById('d-floor-label');
  if (flEl) flEl.textContent = `B${Party.floor}F`;
}

function drawMinimap() {
  const canvas = document.getElementById('minimap-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cw = W / _cols, ch = H / _rows;
  ctx.clearRect(0, 0, W, H);

  for (let r = 0; r < _rows; r++) {
    for (let c = 0; c < _cols; c++) {
      const t = _map[r][c];
      ctx.fillStyle = t === '1' ? '#1a1010' : t === 'E' ? '#ffdd44' : t === 'S' || t === 'U' ? '#44ff88' : '#5a3a3a';
      ctx.fillRect(c*cw+0.5, r*ch+0.5, cw-1, ch-1);
    }
  }

  // プレイヤー
  ctx.fillStyle = '#00ffcc';
  const px = Party.pos.x * cw + cw/2, pz = Party.pos.z * ch + ch/2;
  ctx.beginPath(); ctx.arc(px, pz, Math.min(cw, ch)*0.4, 0, Math.PI*2); ctx.fill();
  // 向き
  const d = DIRS[Party.dir];
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(px, pz); ctx.lineTo(px + d.dx*cw*0.8, pz + d.dz*ch*0.8); ctx.stroke();
}

let _msgTimer;
function setMsg(text) {
  const el = document.getElementById('d-msg');
  if (!el) return;
  el.innerHTML = text.replace(/\n/g, '<br>');
  el.style.opacity = '1';
  clearTimeout(_msgTimer);
  _msgTimer = setTimeout(() => { el.style.opacity = '0'; }, 4000);
}
