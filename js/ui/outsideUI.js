// ============================================================
// js/ui/outsideUI.js — 外に出る：ダンジョン入口・訓練場
// ============================================================
// このファイルの役割：
//   街の外側の画面を制御します。
//   2つの入口があります：
//     1. 「ダンジョンへ」ボタン: 生存パーティがいればダンジョン画面へ進む
//     2. 「訓練場」ボタン: キャラクター作成モーダルを開いて新規キャラを登録する
//
// ダンジョン入場制限：
//   パーティに生存しているメンバーが 0 人の場合、
//   警告ダイアログを表示して中に進めない。
//   パーティ編成は酒場（tavernUI）で行う。
// ============================================================
import { Party, showScreen } from '../gameState.js';
import { isAlive } from '../character.js';
import { openCharCreateModal } from './charCreateModal.js';

/**
 * 「外に出る」画面を初期化して show/hide を返す
 */
export function initOutsideUI() {
  const el = document.getElementById('screen-outside');

  // 戻るボタン → 街画面へ
  document.getElementById('btn-outside-back').addEventListener('click', () => showScreen('town'));

  // ダンジョンへボタン
  document.getElementById('btn-outside-dungeon').addEventListener('click', () => {
    // 生存パーティエントリーチェック
    // filter(isAlive) → isAlive が true を返すケラスだけ抽出
    const alive = Party.members.filter(isAlive);
    if (alive.length === 0) {
      // 生存者がいなければ入場不可
      alert('生存しているパーティメンバーがいません！\n酒場でパーティを編成してください。');
      return;
    }
    showScreen('dungeon'); // ダンジョン画面へ進む
  });

  // 訓練場ボタン → キャラクター作成モーダルを開く
  document.getElementById('btn-outside-training').addEventListener('click', () => {
    // openCharCreateModal にコールバックを渡す：
    // 作成完了後にロスターに追加される
    openCharCreateModal(char => {
      Party.roster.push(char);
      alert(`${char.name} が冒険者名簿に登録されました！\n酒場でパーティに加えてください。`);
    });
  });

  return {
    show() { el.style.display = 'flex'; },
    hide() { el.style.display = 'none'; },
  };
}

// 以下は旧コード（現在は使われていないレガシー関数）
// charCreateModal.js に統合されたため、こちらの関数は呼び出されていません。
// 未来的に削除予定。

function showTrainingModal() {
  _fromTraining = true;
  const modal = document.getElementById('char-create-modal');
  modal.style.display = 'flex';
  const sel = document.getElementById('cc-job');
  sel.innerHTML = '';
  for (const id of JOB_ORDER) {
    const job = DB.jobs[id];
    if (!job) continue;
    const opt = document.createElement('option');
    opt.value = id; opt.textContent = job.name;
    sel.appendChild(opt);
  }
  renderJobStats(sel.value);
  document.getElementById('cc-name').value = '';

  // cancel は outside 画面に留まる
  const cancelBtn = document.getElementById('btn-cc-cancel');
  cancelBtn.onclick = () => {
    document.getElementById('char-create-modal').style.display = 'none';
    _fromTraining = false;
  };
}

function renderJobStats(jobId) {
  const job = DB.jobs[jobId];
  if (!job) return;
  document.getElementById('cc-stats').innerHTML = `
    <tr><td>HP骰子</td><td>d${job.hp_die}</td><td>MP骰子</td><td>${job.mp_die > 0 ? 'd'+job.mp_die : '-'}</td></tr>
    <tr><td>力</td><td>${job.str}</td><td>知性</td><td>${job.int}</td></tr>
    <tr><td>信仰</td><td>${job.pie}</td><td>体力</td><td>${job.vit}</td></tr>
    <tr><td>素早さ</td><td>${job.agi}</td><td>運</td><td>${job.luk}</td></tr>
    <tr><td colspan="4" class="cc-desc">${job.desc}</td></tr>
  `;
}

// cc-job change は tavernUI / outsideUI 両方が同じ要素を使うため
// outsideUI 表示中だけ適用したいが、共通モーダルなので onchange に渡す
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cc-job')?.addEventListener('change', e => {
    renderJobStats(e.target.value);
  });
});

function giveStarterEquip(char, jobId) {
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
  if (starter.weapon) char.equip.weapon = starter.weapon;
  if (starter.armor)  char.equip.armor  = starter.armor;
  char.items.push('potion_hp_s', 'potion_hp_s');
}
