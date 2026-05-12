// js/ui/charCreateModal.js — キャラ作成モーダル共通制御
import { DB } from '../gameState.js';
import { createCharacter } from '../character.js';

const JOB_ORDER = ['warrior','mage','priest','thief','samurai','bishop','lord','ninja'];

let _onSubmitCallback = null;

/** モーダルを開く。submitされたら callback(char) を呼ぶ */
export function openCharCreateModal(onSubmit) {
  _onSubmitCallback = onSubmit;

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
  document.getElementById('cc-name').value = '';
  renderJobStats(sel.value);
}

export function closeCharCreateModal() {
  document.getElementById('char-create-modal').style.display = 'none';
  _onSubmitCallback = null;
}

/** main.js 起動時に一度だけ呼ぶ */
export function initCharCreateModal() {
  document.getElementById('cc-job').addEventListener('change', e => {
    renderJobStats(e.target.value);
  });

  document.getElementById('btn-cc-cancel').addEventListener('click', () => {
    closeCharCreateModal();
  });

  document.getElementById('char-create-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!_onSubmitCallback) return;
    const name  = document.getElementById('cc-name').value.trim() || '冒険者';
    const jobId = document.getElementById('cc-job').value;
    const char  = createCharacter(name, jobId);
    giveStarterEquip(char, jobId);
    closeCharCreateModal();
    _onSubmitCallback(char);
  });
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
