// ============================================================
// js/ui/tavernUI.js — 酒場：冒険者登録・パーティ編成
// ============================================================
// このファイルの役割：
//   冒険者を登録・管理する「酒場」画面の制御を行います。
//
// 2つのリストを管理：
//   1. ロスター（roster）: 登録した冒険者全員のリスト（最大上限なし）
//   2. パーティ（members）: 実際にダンジョンへ連れて行くメンバー（最大6人）
//
// ユーザー操作の流れ：
//   1. 「新規登録」ボタン → charCreateModal でキャラ作成 → ロスターに追加
//   2. ロスターのキャラをクリックして選択
//   3. 「パーティに加える」ボタン → 選択キャラをパーティへ移動
//   4. 「外す」ボタン → パーティから最後のメンバーを外す
//
// UI の更新は renderAll() を呼ぶだけで全部まとめて再描画されます。
// ============================================================
import { Party, DB, showScreen } from '../gameState.js';
import { isAlive } from '../character.js';
import { openCharCreateModal } from './charCreateModal.js';
import { initLocationBackground } from './locationBackground.js';

// Three.js ロケーション背景（酒場の3D背景）
let _bg = null;

// 現在ロスターで選択中のキャラクターのインデックス
// -1 = 選択なし
let _selectedRosterIdx = -1;

/**
 * 酒場画面を初期化して show/hide を持つオブジェクトを返す
 */
export function initTavernUI() {
  const el = document.getElementById('screen-tavern');

  // 「街に戻る」ボタン
  document.getElementById('btn-tavern-back').addEventListener('click', () => showScreen('town'));

  // 「新規冒険者登録」ボタン → キャラ作成モーダルを開く
  document.getElementById('btn-tavern-new-char').addEventListener('click', () => {
    // openCharCreateModal に「作成完了後の処理」をコールバックで渡す
    openCharCreateModal(char => {
      Party.roster.push(char); // ロスターに追加
      renderAll();             // 画面を更新
    });
  });

  // 「パーティに加える」ボタン
  document.getElementById('btn-tavern-add-party').addEventListener('click', () => {
    if (_selectedRosterIdx < 0) { alert('冒険者を選択してください。'); return; }
    const char = Party.roster[_selectedRosterIdx];
    if (!char) return;
    if (!isAlive(char))              { alert('死亡・石化した冒険者はパーティに加えられません。'); return; }
    if (Party.members.includes(char)) { alert('すでにパーティにいます。'); return; }
    if (Party.members.length >= 6)   { alert('パーティは最大6人です。'); return; }
    Party.members.push(char);   // パーティに追加
    _selectedRosterIdx = -1;    // 選択を解除
    renderAll();
  });

  // 「パーティから外す」ボタン（最後尾のキャラを外す）
  document.getElementById('btn-tavern-remove-party').addEventListener('click', () => {
    if (Party.members.length === 0) return;
    Party.members.pop(); // 配列の末尾要素を取り除く
    renderAll();
  });

  return {
    show() {
      el.style.display = 'flex';
      _bg ??= initLocationBackground('tavern'); // 初回のみ背景を初期化
      if (_bg) _bg.start();
      _selectedRosterIdx = -1;
      renderAll(); // 常に最新状態を表示
    },
    hide() { el.style.display = 'none'; if (_bg) _bg.stop(); },
  };
}

// ============================================================
// 内部描画関数
// ============================================================

/**
 * パーティリストとロスターリストを一括再描画する
 */
function renderAll() {
  renderParty();
  renderRoster();
}

/**
 * パーティメンバーリストを描画する
 * Party.members 配列の順に表示する
 */
function renderParty() {
  const list = document.getElementById('tavern-party-list');
  const cnt  = document.getElementById('tavern-party-count');
  if (!list) return;
  cnt.textContent = `(${Party.members.length}/6)`;
  list.innerHTML = ''; // リストをクリアしてから再描画
  Party.members.forEach((c, i) => {
    const job = DB.jobs[c.jobId];
    const div = document.createElement('div');
    // isAlive が false なら 'dead' クラスを追加（グレー表示）
    div.className = 'party-member' + (isAlive(c) ? '' : ' dead');
    div.innerHTML = buildMemberHTML(c, i + 1, job);
    list.appendChild(div);
  });
  if (Party.members.length === 0) {
    list.innerHTML = '<div style="color:#504060;font-size:0.78rem;padding:10px;">パーティは空です</div>';
  }
}

/**
 * ロスター（冒険者名簿）リストを描画する
 * 選択中・パーティ所属・死亡状態でスタイルが変わる
 */
function renderRoster() {
  const list = document.getElementById('tavern-roster-list');
  const cnt  = document.getElementById('tavern-roster-count');
  if (!list) return;
  cnt.textContent = `(${Party.roster.length})`;
  list.innerHTML = '';
  Party.roster.forEach((c, i) => {
    const job     = DB.jobs[c.jobId];
    const inParty = Party.members.includes(c); // パーティに所属しているか
    const div     = document.createElement('div');
    // クラス名を動的に組み立てる（複数条件）
    div.className = 'roster-member'
      + (isAlive(c)  ? '' : ' dead')       // 死亡中
      + (inParty     ? ' in-party' : '')   // パーティ所属中
      + (_selectedRosterIdx === i ? ' selected' : ''); // 選択中
    div.innerHTML = buildMemberHTML(c, i + 1, job)
      + (inParty ? '<div style="font-size:0.7rem;color:#60c060;margin-top:3px;">✔ パーティ中</div>' : '');

    // クリックで選択トグル（同じキャラを再クリックすると選択解除）
    div.addEventListener('click', () => {
      _selectedRosterIdx = (_selectedRosterIdx === i) ? -1 : i;
      renderRoster(); // 選択状態を反映して再描画
    });
    list.appendChild(div);
  });
  if (Party.roster.length === 0) {
    list.innerHTML = '<div style="color:#504060;font-size:0.78rem;padding:10px;">冒険者がいません<br>「新規登録」で作成してください</div>';
  }
}

/**
 * キャラクター1人分のHTMLを生成する
 * パーティリストとロスターリストの両方で使い回す共通テンプレート
 *
 * @param {object} c   - キャラクターオブジェクト
 * @param {number} num - 表示番号（1始まり）
 * @param {object} job - 職業データ
 * @returns {string}   - HTML文字列
 */
function buildMemberHTML(c, num, job) {
  // HP/MP のパーセンテージを計算してバーの幅に使う
  const hpPct = Math.max(0, c.hp / c.maxHp * 100);   // 最低0%（マイナスにならない）
  const mpPct = c.maxMp > 0 ? Math.max(0, c.mp / c.maxMp * 100) : 0;
  return `
    <div class="pm-row">
      <span class="pm-num">${num}</span>
      <span class="pm-name">${c.name}</span>
      <span class="pm-job">${job?.name || c.jobId}</span>
      <span class="pm-lv">Lv.${c.level}</span>
    </div>
    <div class="pm-bars">
      <span>HP</span>
      <div class="bar-bg"><div class="bar hp-bar" style="width:${hpPct}%"></div></div>
      <span class="pm-hp">${c.hp}/${c.maxHp}</span>
      ${c.maxMp > 0 ? `<span>MP</span><div class="bar-bg sm"><div class="bar mp-bar" style="width:${mpPct}%"></div></div><span class="pm-hp">${c.mp}/${c.maxMp}</span>` : ''}
    </div>
    <div class="pm-status ${c.status !== 'ok' ? 'bad' : ''}">${statusLabel(c.status)}</div>
  `;
}

/**
 * 状態値を日本語テキストに変換する
 * @param {string} s - 状態 ID
 * @returns {string} - 日本語ラベル
 */
function statusLabel(s) {
  const map = { ok:'正常', poisoned:'毒', asleep:'眠り', paralyzed:'麻痺', stoned:'石化', dead:'死亡', ashes:'灰' };
  return map[s] || s;
}


