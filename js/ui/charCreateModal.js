// ============================================================
// js/ui/charCreateModal.js — キャラクター作成モーダル
// ============================================================
// このファイルの役割：
//   「キャラクター作成」のモーダルウィンドウ（ポップアップ画面）を制御します。
//   このモーダルは酒場（tavernUI.js）と訓練場（outsideUI.js）の両方から
//   呼び出せるように「共通部品」として設計されています。
//
// 「モーダル」とは？
//   他の操作をブロックして最前面に表示される小窓のこと。
//   入力が終わるまで後ろの画面に触れられない仕組みです。
//
// コールバックパターン：
//   openCharCreateModal(callback) という形で呼ぶと、
//   キャラクター作成が完了したとき callback(char) が実行されます。
//   これにより「呼び出し元に結果を渡す」ことができます。
// ============================================================
import { DB } from '../gameState.js';
import { createCharacter } from '../character.js';

// 職業選択ドロップダウンに表示する順番
// この順番を変えれば選択肢の並びが変わります
const JOB_ORDER = ['warrior','mage','priest','thief','samurai','bishop','lord','ninja'];

// キャラクター作成完了時に呼び出す関数を保持する変数
// let = 後から書き換えられる変数（const は書き換え不可）
let _onSubmitCallback = null;

/**
 * モーダルを開く
 * @param {Function} onSubmit - キャラクター作成完了後に呼ばれるコールバック関数
 *                              引数に作成したキャラクターオブジェクトが渡される
 */
export function openCharCreateModal(onSubmit) {
  // コールバックを保存しておく（後で submitイベント 時に使う）
  _onSubmitCallback = onSubmit;

  // モーダル要素を表示する（CSS の display を flex に変えるだけ）
  const modal = document.getElementById('char-create-modal');
  modal.style.display = 'flex';

  // 職業選択ドロップダウンを初期化する
  const sel = document.getElementById('cc-job');
  sel.innerHTML = ''; // 既存の選択肢をクリア
  for (const id of JOB_ORDER) {
    const job = DB.jobs[id];  // DB から職業データを取得
    if (!job) continue;        // データがなければスキップ
    const opt = document.createElement('option'); // <option> 要素を作成
    opt.value = id;            // 内部値（例: 'warrior'）
    opt.textContent = job.name; // 表示テキスト（例: '戦士'）
    sel.appendChild(opt);       // ドロップダウンに追加
  }
  document.getElementById('cc-name').value = ''; // 名前入力欄をクリア
  renderJobStats(sel.value); // 最初の職業のステータスを表示
}

/**
 * モーダルを閉じる
 * コールバックも null にリセットして使い回しに備える
 */
export function closeCharCreateModal() {
  document.getElementById('char-create-modal').style.display = 'none';
  _onSubmitCallback = null; // コールバックをリセット（メモリリーク防止）
}

/**
 * モーダルのイベントリスナーを登録する（main.js から起動時に1回だけ呼ぶ）
 *
 * この関数でやること：
 *   - 職業変更時にステータス表示を更新
 *   - キャンセルボタンでモーダルを閉じる
 *   - フォーム送信でキャラクターを作成してコールバックを呼ぶ
 */
export function initCharCreateModal() {
  // 職業ドロップダウンが変わったらステータス表示を更新する
  document.getElementById('cc-job').addEventListener('change', e => {
    renderJobStats(e.target.value); // 選ばれた職業 ID を渡す
  });

  // キャンセルボタン → モーダルを閉じるだけ
  document.getElementById('btn-cc-cancel').addEventListener('click', () => {
    closeCharCreateModal();
  });

  // フォームの送信（「作成」ボタン押下）
  document.getElementById('char-create-form').addEventListener('submit', e => {
    e.preventDefault(); // フォームのデフォルト動作（ページリロード）を防ぐ
    if (!_onSubmitCallback) return; // コールバックが設定されていなければ何もしない

    // 入力値を取得（名前が空なら「冒険者」をデフォルトにする）
    const name  = document.getElementById('cc-name').value.trim() || '冒険者';
    const jobId = document.getElementById('cc-job').value;

    // character.js の createCharacter でキャラクターを生成
    const char  = createCharacter(name, jobId);
    giveStarterEquip(char, jobId); // 職業に合った初期装備を渡す

    closeCharCreateModal(); // モーダルを閉じてから
    _onSubmitCallback(char); // 呼び出し元に作成したキャラを渡す
  });
}

/**
 * 選択された職業のステータスをモーダル内のテーブルに表示する
 * @param {string} jobId - 表示したい職業の ID
 */
function renderJobStats(jobId) {
  const job = DB.jobs[jobId];
  if (!job) return;
  // テンプレートリテラル（バッククォート囲み）で HTML を生成して挿入
  document.getElementById('cc-stats').innerHTML = `
    <tr><td>HP骰子</td><td>d${job.hp_die}</td><td>MP骰子</td><td>${job.mp_die > 0 ? 'd'+job.mp_die : '-'}</td></tr>
    <tr><td>力</td><td>${job.str}</td><td>知性</td><td>${job.int}</td></tr>
    <tr><td>信仰</td><td>${job.pie}</td><td>体力</td><td>${job.vit}</td></tr>
    <tr><td>素早さ</td><td>${job.agi}</td><td>運</td><td>${job.luk}</td></tr>
    <tr><td colspan="4" class="cc-desc">${job.desc}</td></tr>
  `;
}

/**
 * 新規キャラクターに職業対応の初期装備とアイテムを与える
 * @param {object} char  - 作成されたキャラクターオブジェクト（直接書き換える）
 * @param {string} jobId - 職業 ID
 *
 * 職業によって初期武器・防具が異なります：
 *   - 戦士・侍・君主: 短剣 + 革鎧
 *   - 魔法使い・司教: 杖 or 短剣 + ローブ
 *   - 盗賊・忍者: 短剣 + 革鎧
 * 全員に小ポーションを2本プレゼントする
 */
function giveStarterEquip(char, jobId) {
  // 職業ごとの初期装備マップ（weapon: 武器ID, armor: 防具ID）
  const starterMap = {
    warrior: { weapon: 'short_sword', armor: 'leather_armor' },
    mage:    { weapon: 'staff',       armor: 'robe' },
    priest:  { weapon: 'mace',        armor: 'robe' },
    thief:   { weapon: 'dagger',      armor: 'leather_armor' },
    samurai: { weapon: 'short_sword', armor: 'leather_armor' },
    bishop:  { weapon: 'dagger',      armor: 'robe' },
    lord:    { weapon: 'short_sword', armor: 'leather_armor' },
    ninja:   { weapon: 'dagger',      armor: 'leather_armor' },
  };
  const starter = starterMap[jobId] || {};
  if (starter.weapon) char.equip.weapon = starter.weapon; // 武器スロットに設定
  if (starter.armor)  char.equip.armor  = starter.armor;  // 防具スロットに設定
  // 小ポーションを2個インベントリに追加（同じ ID を2つ push するだけ）
  char.items.push('potion_hp_s', 'potion_hp_s');
}
