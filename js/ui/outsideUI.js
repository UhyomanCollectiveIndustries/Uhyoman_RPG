// js/ui/outsideUI.js — 外に出る：ダンジョン or 訓練場
import { Party, showScreen } from '../gameState.js';
import { isAlive } from '../character.js';
import { openCharCreateModal } from './charCreateModal.js';

export function initOutsideUI() {
  const el = document.getElementById('screen-outside');

  document.getElementById('btn-outside-back').addEventListener('click', () => showScreen('town'));

  // ダンジョンへ
  document.getElementById('btn-outside-dungeon').addEventListener('click', () => {
    const alive = Party.members.filter(isAlive);
    if (alive.length === 0) {
      alert('生存しているパーティメンバーがいません！\n酒場でパーティを編成してください。');
      return;
    }
    showScreen('dungeon');
  });

  // 訓練場（キャラ作成）
  document.getElementById('btn-outside-training').addEventListener('click', () => {
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
