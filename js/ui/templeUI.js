// ============================================================
// js/ui/templeUI.js — 寺院：蘇生・治療
// ============================================================
// このファイルの役割：
//   ダンジョンで死亡・状態異常になったキャラクターを
//   ゴールドを払って回復する「寺院」画面の制御を行います。
//
// 治療パターン：
//   - dead（死亡）: 蘇生 2050G
//   - ashes（灘）: 復元│500G、失敗硧50%
//   - stoned（石化）: 石化解除│100G
//   - poisoned（毒）: 解毒│50G
//   - asleep（眠り）: 覚醒│30G
//   - paralyzed（麻痺）: 麻痺解除│80G
//
// Wizardry のルール：
//   灘状態は復元に失敗することがあり（確率 50%）、
//   失敗するとゴールドだけ失ってままならないというリスクがあります。
// ============================================================
import { Party, DB, showScreen } from '../gameState.js';
import { isAlive } from '../character.js';
import { initLocationBackground } from './locationBackground.js';

// Three.js ロケーション背景
// ??= 演算子：初回表示時にだけ初期化し、次回以降はキャッシュしたオブジェクトを再利用
let _bg = null;

// 状態別の治療費用テーブル
// キー: キャラクターの status 値、値: 必要なゴールド数
const REVIVE_COST  = { dead: 200, ashes: 500, stoned: 100, poisoned: 50, asleep: 30, paralyzed: 80 };

// 状態別のボタンラベル（画面に表示する文字）
const REVIVE_LABEL = { dead: '蘇生', ashes: '復元', stoned: '石化解除', poisoned: '解毒', asleep: '覚醒', paralyzed: '麻痺解除' };

// 現在選択中のキャラクターのインデックス
let _selectedIdx = -1;

/**
 * 寺院画面を初期化して show/hide を返す
 */
export function initTempleUI() {
  const el = document.getElementById('screen-temple');
  document.getElementById('btn-temple-back').addEventListener('click', () => showScreen('town'));

  return {
    show() {
      el.style.display = 'flex';
      _bg ??= initLocationBackground('temple'); // 初回表示時に背景を初期化
      if (_bg) _bg.start();
      _selectedIdx = -1;
      renderRoster(); // 治療が必要なキャラをリスト表示
    },
    hide() { el.style.display = 'none'; if (_bg) _bg.stop(); },
  };
}

/**
 * 治療が必要なキャラクターのリストを描画する
 * Party.roster から status ≠ 'ok' のキャラだけを抽出して表示する
 */
function renderRoster() {
  const container = document.getElementById('temple-roster');
  const msg = document.getElementById('temple-msg');
  if (!container) return;
  container.innerHTML = ''; // 既存表示をクリア

  // 治療が必要なキャラをアプリケーションフィルターにより抄出
  const needHelp = Party.roster.filter(c => c.status !== 'ok');

  if (needHelp.length === 0) {
    // 全員健康なら休息メッセージを表示
    container.innerHTML = '<div style="color:#504060;font-size:0.82rem;padding:12px;">治療が必要な者はいません。</div>';
    msg.textContent = '「皆、健康そうですね。神のご加護を。」';
    return;
  }

  msg.textContent = '「神の御加護によって、死者を蘇らせることができます。費用はかかりますが…」';

  needHelp.forEach((c, i) => {
    const realIdx = Party.roster.indexOf(c); // ロスター内の実際のインデックス
    const job     = DB.jobs[c.jobId];
    const cost    = REVIVE_COST[c.status] ?? 100;  // 対応費用（未定義なら 100G）
    const label   = REVIVE_LABEL[c.status] ?? '治療';

    const div = document.createElement('div');
    div.className = 'party-member dead'; // 死亡スタイルを適用
    div.style.cssText = 'cursor:pointer;';
    div.innerHTML = `
      <div class="pm-row">
        <span class="pm-name">${c.name}</span>
        <span class="pm-job">${job?.name || c.jobId}</span>
        <span class="pm-lv">Lv.${c.level}</span>
        <span style="margin-left:auto;font-size:0.78rem;color:#a06040;">[${statusLabel(c.status)}]</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:6px;align-items:center;">
        <span style="font-size:0.78rem;color:#c0a060;">${label}: ${cost}G</span>
        <button class="btn-secondary temple-action-btn" data-real="${realIdx}" data-cost="${cost}">
          ${label}する
        </button>
      </div>
    `;
    // ボタンクリックで治療実行
    // stopPropagation → 親要素へのイベント伝発を止める（二重発火防止）
    div.querySelector('button').addEventListener('click', e => {
      e.stopPropagation();
      doHeal(realIdx, cost, c.status);
    });
    container.appendChild(div);
  });
}

/**
 * 治療・蘇生処理を実行する
 * @param {number} rosterIdx - 対象キャラのロスターインデックス
 * @param {number} cost      - 必要ゴールド
 * @param {string} status    - 現在の状態（'dead', 'ashes', ...）
 */
function doHeal(rosterIdx, cost, status) {
  const c = Party.roster[rosterIdx];
  if (!c) return;
  const msg = document.getElementById('temple-msg');

  // 所持金チェック
  if (Party.gold < cost) {
    msg.textContent = `「費用が足りません。${cost}Gが必要です。」`;
    return;
  }

  // 灘状態は 50% の確率で蘇生失敗（Wizardry の独自ルール）
  // Math.random() → 0以上1未満の乱数、< 0.5 → 50%の確率で失敗
  if (status === 'ashes' && Math.random() < 0.5) {
    Party.gold -= cost; // 失敗でもゴールドは消費される
    msg.textContent = `「…${c.name}は、神の加護を受けることができませんでした。(${cost}G消費)」`;
    renderRoster();
    return;
  }

  Party.gold -= cost;   // 治療費用を消費
  c.status = 'ok';      // 状態を正常に戻す
  if (status === 'dead' || status === 'ashes') {
    // 蘇生時は HP 1 で復活（実際の Wizardry のルールと同じ）
    c.hp = 1;
  }
  msg.textContent = `「${c.name}は無事に${REVIVE_LABEL[status] || '治療'}されました。」`;
  renderRoster(); // リストを再描画（治療したキャラが消える）
}

/**
 * 状態値を日本語表示に変換する
 * @param {string} s - 状態 ID
 * @returns {string} - 日本語表示
 */
function statusLabel(s) {
  const map = { ok:'正常', poisoned:'毒', asleep:'眠り', paralyzed:'麻痺', stoned:'石化', dead:'死亡', ashes:'灘' };
  return map[s] || s;
}
