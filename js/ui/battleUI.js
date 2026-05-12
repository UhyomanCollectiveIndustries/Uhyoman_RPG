// ============================================================
// js/ui/battleUI.js — Wizardry 風コマンド式バトル画面
// ============================================================
//
// このファイルの役割：
//   battle.js（戦闘エンジン）から呼ばれる描画関数を提供します。
//   バトルのロジック（攻撃計算・行動順など）は battle.js が担当し、
//   このファイルは「見た目（UI）の更新」だけを担当します。
//
// 主要エクスポート：
//   initBattleUI()  → show/hide オブジェクトを返す（main.js から呼ぶ）
//   renderBattle()  → battle.js から呼ばれる描画関数（毎ターン呼ばれる）
//
// 描画の構成：
//   - 敵ゾーン（上部）   : 敵名・HP バー
//   - ログパネル（中央）  : 直近 8 行の戦闘ログ
//   - パーティストリップ（下部左）: 全パーティメンバーの HP・状態
//   - コマンドパネル（下部右）  : 攻撃/呪文/アイテム/逃げる ボタン
//   - リザルトパネル     : 勝利/全滅/逃走メッセージ + 次へボタン
//
// サブパネル（コマンドパネル内で切り替わる）：
//   showTargetSelect() : 攻撃対象を選ぶ
//   showSpellSelect()  : 使用呪文を選ぶ
//   showAllySelect()   : 回復対象（味方）を選ぶ
//   showItemSelect()   : 使用アイテムを選ぶ
// ============================================================
import { Party, DB } from '../gameState.js';
import { registerCommand, battleContinue } from '../battle.js';
import { isActive } from '../character.js';

/**
 * バトル UI を初期化する。show/hide オブジェクトを返す。
 * （main.js の registerScreen から呼ばれる）
 */
export function initBattleUI() {
  const el = document.getElementById('screen-battle');
  return {
    show() { el.style.display = 'flex'; },
    hide() { el.style.display = 'none'; },
  };
}

// ============================================================
// メイン描画関数（battle.js から呼ばれる）
// ============================================================

/**
 * バトル状態全体を受け取って画面を更新する。
 * battle.js の startBattle/executeRound が呼ぶ。
 *
 * @param {object} state
 * @param {Array}   state.enemies   - 敵オブジェクト配列（{name, hp, maxHp, ...}）
 * @param {Array}   state.log       - 戦闘ログ文字列の配列
 * @param {string}  state.phase     - 'command'（コマンド入力）| 'resolving'（解決中）| 'result'（結果表示）
 * @param {number}  state.cmdIndex  - 現在コマンド入力中のパーティメンバーのインデックス
 * @param {Array}   state.cmds      - すでに登録されたコマンド配列
 * @param {boolean} state.win       - 勝利フラグ
 * @param {boolean} state.fled      - 逃走成功フラグ
 */
export function renderBattle({ enemies, log, phase, cmdIndex, cmds, win, fled }) {
  renderEnemies(enemies);        // 敵 HP バーを更新
  renderLog(log);                // 戦闘ログを更新
  renderPartyStrip();            // パーティメンバーの HP・状態を更新

  const cmdPanel    = document.getElementById('b-command-panel');
  const resultPanel = document.getElementById('b-result-panel');

  if (phase === 'command') {
    // コマンド入力フェーズ：コマンドパネルを表示
    cmdPanel.style.display    = 'flex';
    resultPanel.style.display = 'none';
    renderCommandPanel(cmdIndex, enemies); // 現在のキャラのコマンドボタンを生成
  } else if (phase === 'result') {
    // 結果フェーズ：コマンドパネルを隠してリザルトを表示
    cmdPanel.style.display    = 'none';
    resultPanel.style.display = 'flex';
    // 逃げた → 負けた → 勝った の順で優先
    const msg = fled ? '逃げ出した！' : win ? '勝利！' : '全滅…';
    document.getElementById('b-result-msg').textContent = msg;
    // 「次へ」ボタンを押したら battle.js の battleContinue() を呼んで画面遷移
    document.getElementById('btn-b-continue').onclick = () => battleContinue();
  } else {
    // 解決中（resolving）は両パネルを隠す（ログだけ流れる）
    cmdPanel.style.display    = 'none';
    resultPanel.style.display = 'none';
  }
}

// ============================================================
// 敵ゾーン描画
// ============================================================

/**
 * 敵の名前・HP バー・HP 数値を描画する。
 * HP が 0 以下の敵は 'dead' クラスを付けてグレーアウトする。
 * @param {Array} enemies - 敵オブジェクト配列
 */
function renderEnemies(enemies) {
  const zone = document.getElementById('b-enemy-zone');
  zone.innerHTML = ''; // 前回の描画を削除
  enemies.forEach((e, i) => {
    const div = document.createElement('div');
    div.className = 'b-enemy' + (e.hp <= 0 ? ' dead' : ''); // 倒れた敵は .dead
    div.innerHTML = `
      <div class="b-enemy-name">${e.name}</div>
      <div class="bar-bg">
        <div class="bar hp-bar" style="width:${Math.max(0, e.hp / e.maxHp * 100)}%"></div>
      </div>
      <div class="b-enemy-hp">${e.hp <= 0 ? '倒れた' : `HP ${e.hp}`}</div>
    `;
    zone.appendChild(div);
  });
}

// ============================================================
// 戦闘ログ描画
// ============================================================

/**
 * 戦闘ログの直近 8 行を表示する。
 * 長いログは最新行が常に見えるよう自動スクロールする。
 * @param {Array<string>} log - ログ文字列の配列
 */
function renderLog(log) {
  const el = document.getElementById('b-log');
  el.innerHTML = '';
  const recent = log.slice(-8); // 最後の 8 件のみ表示
  for (const line of recent) {
    const p = document.createElement('div');
    p.className  = 'b-log-line';
    p.textContent = line;
    el.appendChild(p);
  }
  el.scrollTop = el.scrollHeight; // 最下部にスクロール
}

// ============================================================
// パーティストリップ描画
// ============================================================

/**
 * パーティメンバー全員の HP バー・ステータスを描画する。
 * isActive() が false（死亡・石化など）の場合 'dead' クラスを付ける。
 */
function renderPartyStrip() {
  const el = document.getElementById('b-party-strip');
  el.innerHTML = '';
  Party.members.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'b-party-member' + (isActive(c) ? '' : ' dead'); // 行動不能なら .dead
    const job = DB.jobs[c.jobId];
    div.innerHTML = `
      <div class="bpm-name">${c.name}<span class="bpm-job">${job?.name || ''}</span></div>
      <div class="bpm-hp">${c.hp}/${c.maxHp} HP</div>
      <div class="bar-bg">
        <div class="bar hp-bar" style="width:${Math.max(0, c.hp / c.maxHp * 100)}%"></div>
      </div>
      <div class="bpm-status ${c.status !== 'ok' ? 'bad' : ''}">${statusLabel(c.status)}</div>
    `;
    el.appendChild(div);
  });
}

// ============================================================
// コマンドパネル描画
// ============================================================

/**
 * 現在コマンド入力中のキャラクターのコマンドボタンを生成する。
 * 攻撃 / 呪文（MP > 0 なら表示）/ アイテム（所持あれば表示）/ 逃げる
 * @param {number} cmdIndex - Party.members のインデックス
 * @param {Array}  enemies  - 敵オブジェクト配列（ターゲット選択に使う）
 */
function renderCommandPanel(cmdIndex, enemies) {
  const char = Party.members[cmdIndex];
  if (!char) return;
  const job = DB.jobs[char.jobId];
  document.getElementById('b-cmd-title').textContent = `${char.name} (${job?.name}) のコマンド`;

  const btns = document.getElementById('b-cmd-btns');
  btns.innerHTML = ''; // 前のボタンをクリア

  // 攻撃ボタン：クリックするとターゲット選択サブパネルを開く
  addCmdBtn(btns, '攻撃', () => {
    // 最初の生存敵のインデックスを取得（デフォルトターゲット用）
    const ti = enemies.findIndex(e => e.hp > 0);
    if (ti === -1) return;
    // showTargetSelect() でユーザーにターゲットを選ばせ、コールバックで registerCommand を呼ぶ
    showTargetSelect(enemies, t => registerCommand({ type: 'attack', target: t }));
  });

  // 呪文ボタン：最大 MP が 0 より大きいキャラにのみ表示
  if (char.maxMp > 0) {
    addCmdBtn(btns, '呪文', () => {
      showSpellSelect(char, enemies); // 使用可能呪文リストを表示
    });
  }

  // アイテムボタン：所持品がある場合のみ表示
  if (char.items.length > 0) {
    addCmdBtn(btns, 'アイテム', () => {
      showItemSelect(char); // アイテムリストを表示
    });
  }

  // 逃げるボタン：即座に battleContinue フラグを立てる
  addCmdBtn(btns, '逃げる', () => {
    registerCommand({ type: 'flee' });
  });
}

/**
 * コマンドボタンを生成して親要素に追加するヘルパー。
 * @param {HTMLElement} parent - ボタンを追加する親要素
 * @param {string}      label  - ボタンのラベル
 * @param {Function}    onClick - クリック時のコールバック
 */
function addCmdBtn(parent, label, onClick) {
  const btn = document.createElement('button');
  btn.className = 'b-cmd-btn';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  parent.appendChild(btn);
}

// ============================================================
// サブパネル（コマンドパネル内で切り替わる）
// ============================================================

/**
 * 敵のターゲット選択サブパネルを表示する。
 * 生存している敵だけボタンを生成し、選択されたら cb(インデックス) を呼ぶ。
 * @param {Array}    enemies - 敵配列
 * @param {Function} cb      - ターゲット選択後のコールバック（引数：敵インデックス）
 */
function showTargetSelect(enemies, cb) {
  const panel = document.getElementById('b-cmd-btns');
  panel.innerHTML = '<div class="b-sub-title">ターゲット選択</div>';
  enemies.forEach((e, i) => {
    if (e.hp <= 0) return; // 倒れた敵はスキップ
    const btn = document.createElement('button');
    btn.className  = 'b-cmd-btn';
    btn.textContent = e.name;
    btn.addEventListener('click', () => cb(i)); // クリックでインデックスを渡す
    panel.appendChild(btn);
  });
}

/**
 * 使用可能な呪文の選択サブパネルを表示する。
 * DB.spells から「このキャラが使える・MP が足りる」呪文だけを抽出する。
 * @param {object} char    - 使用キャラクター
 * @param {Array}  enemies - 敵配列（攻撃呪文のターゲット選択に使う）
 */
function showSpellSelect(char, enemies) {
  // 使用可能な呪文をフィルタリング：
  //   s.jobs.includes(char.jobId)  → このジョブが使える呪文か
  //   s.level <= char.level        → 習得できるレベルか
  //   char.mp >= s.mp_cost         → MP が足りるか
  const availableSpells = Object.values(DB.spells).filter(s =>
    s.jobs.includes(char.jobId) && s.level <= char.level && char.mp >= s.mp_cost
  );

  const panel = document.getElementById('b-cmd-btns');
  panel.innerHTML = '<div class="b-sub-title">呪文選択</div>';
  for (const sp of availableSpells) {
    const btn = document.createElement('button');
    btn.className  = 'b-cmd-btn';
    btn.textContent = `${sp.name} (MP:${sp.mp_cost})`;
    btn.addEventListener('click', () => {
      // 呪文のターゲットタイプで処理を分岐する
      if (sp.target === 'all' || sp.target === 'ally_all') {
        // 全体対象呪文：ターゲット選択不要
        registerCommand({ type: 'spell', spellId: sp.id, target: 0 });
      } else if (sp.target === 'ally' || sp.target === 'self') {
        // 味方単体/自分対象：味方選択サブパネルへ
        showAllySelect(t => registerCommand({ type: 'spell', spellId: sp.id, target: t }));
      } else {
        // 敵単体対象：敵ターゲット選択サブパネルへ
        showTargetSelect(enemies, t => registerCommand({ type: 'spell', spellId: sp.id, target: t }));
      }
    });
    panel.appendChild(btn);
  }
}

/**
 * 味方（回復・蘇生呪文）の対象選択サブパネルを表示する。
 * @param {Function} cb - 選択後のコールバック（引数：パーティインデックス）
 */
function showAllySelect(cb) {
  const panel = document.getElementById('b-cmd-btns');
  panel.innerHTML = '<div class="b-sub-title">対象を選択</div>';
  Party.members.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className  = 'b-cmd-btn';
    btn.textContent = `${c.name} (${c.hp}/${c.maxHp})`;
    btn.addEventListener('click', () => cb(i));
    panel.appendChild(btn);
  });
}

/**
 * 所持アイテムの選択サブパネルを表示する。
 * 同じアイテムが複数あれば「x個数」で表示する。
 * @param {object} char - 使用キャラクター
 */
function showItemSelect(char) {
  const panel = document.getElementById('b-cmd-btns');
  panel.innerHTML = '<div class="b-sub-title">アイテム選択</div>';
  const seen = new Set(); // 同じアイテムを複数回表示しないためのセット
  for (const itemId of char.items) {
    if (seen.has(itemId)) continue; // すでに表示済みならスキップ
    seen.add(itemId);
    const item = DB.items[itemId];
    if (!item) continue;
    const btn = document.createElement('button');
    btn.className = 'b-cmd-btn';
    // 同じIDのアイテムを数えて「x2」のように表示
    const cnt = char.items.filter(i => i === itemId).length;
    btn.textContent = `${item.name} x${cnt}`;
    btn.addEventListener('click', () => {
      // アイテムの種類で対象選択フローを分岐
      if (item.type === 'heal' || item.type === 'cure' || item.type === 'revive') {
        // 回復・状態回復・蘇生 → 対象を味方から選ぶ
        showAllySelect(t => registerCommand({ type: 'item', itemId, target: t }));
      } else {
        // 攻撃アイテムなど → 敵全体に使う（target: 0 は先頭/全体を示す）
        registerCommand({ type: 'item', itemId, target: 0 });
      }
    });
    panel.appendChild(btn);
  }
}

// ============================================================
// ヘルパー
// ============================================================

/**
 * ステータスコードを日本語ラベルに変換する。
 * @param {string} s - ステータスコード（'ok'|'poisoned'|'asleep'|...）
 * @returns {string} 日本語ラベル
 */
function statusLabel(s) {
  const map = {
    ok:         '正常',
    poisoned:   '毒',
    asleep:     '眠り',
    paralyzed:  '麻痺',
    stoned:     '石化',
    dead:       '死亡',
    ashes:      '灰',
  };
  return map[s] || s; // 未定義のコードはそのまま表示
}
