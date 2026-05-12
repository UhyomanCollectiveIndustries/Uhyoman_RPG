// js/ui/campUI.js — キャンプ(宿・キャラ管理・冒険準備)画面
import { Party, DB, showScreen } from '../gameState.js';
import { createCharacter, isAlive } from '../character.js';

const JOB_ORDER = ['warrior','mage','priest','thief','samurai','bishop','lord','ninja'];

export function initCampUI() {
  const el = document.getElementById('screen-camp');

  document.getElementById('btn-camp-dungeon').addEventListener('click', () => {
    if (Party.members.length === 0) {
      alert('パーティに誰もいません！');
      return;
    }
    showScreen('dungeon');
  });

  document.getElementById('btn-camp-add').addEventListener('click', () => {
    if (Party.members.length >= 6) { alert('パーティは最大6人です。'); return; }
    showCharCreateModal();
  });

  document.getElementById('btn-camp-remove').addEventListener('click', () => {
    if (Party.members.length === 0) return;
    Party.members.pop();
    renderParty();
  });

  // キャラ作成モーダル送信
  document.getElementById('char-create-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('cc-name').value.trim() || '冒険者';
    const jobId = document.getElementById('cc-job').value;
    const char = createCharacter(name, jobId);
    // 初期装備を付与
    giveStarterEquip(char, jobId);
    Party.members.push(char);
    document.getElementById('char-create-modal').style.display = 'none';
    renderParty();
  });

  document.getElementById('cc-job').addEventListener('change', e => {
    renderJobStats(e.target.value);
  });

  document.getElementById('btn-cc-cancel').addEventListener('click', () => {
    document.getElementById('char-create-modal').style.display = 'none';
  });

  return {
    show() {
      el.style.display = 'flex';
      renderParty();
      renderGold();
    },
    hide() { el.style.display = 'none'; },
  };
}

function showCharCreateModal() {
  const modal = document.getElementById('char-create-modal');
  modal.style.display = 'flex';

  // 職業セレクト構築
  const sel = document.getElementById('cc-job');
  sel.innerHTML = '';
  for (const id of JOB_ORDER) {
    const job = DB.jobs[id];
    if (!job) continue;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = job.name;
    sel.appendChild(opt);
  }
  renderJobStats(sel.value);
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
  // 職業別初期装備
  const starterMap = {
    warrior: { weapon: 'short_sword', armor: 'leather_armor' },
    mage:    { weapon: 'staff', armor: 'robe' },
    priest:  { weapon: 'mace', armor: 'robe' },
    thief:   { weapon: 'dagger', armor: 'leather_armor' },
    samurai: { weapon: 'short_sword', armor: 'leather_armor' },
    bishop:  { weapon: 'dagger', armor: 'robe' },
    lord:    { weapon: 'short_sword', armor: 'leather_armor' },
    ninja:   { weapon: 'dagger', armor: 'leather_armor' },
  };
  const starter = starterMap[jobId] || {};
  if (starter.weapon) char.equip.weapon = starter.weapon;
  if (starter.armor)  char.equip.armor  = starter.armor;
  char.items.push('potion_hp_s', 'potion_hp_s');
}

function renderParty() {
  const list = document.getElementById('party-list');
  list.innerHTML = '';
  Party.members.forEach((c, i) => {
    const job = DB.jobs[c.jobId];
    const div = document.createElement('div');
    div.className = 'party-member' + (isAlive(c) ? '' : ' dead');
    div.innerHTML = `
      <div class="pm-row">
        <span class="pm-num">${i+1}</span>
        <span class="pm-name">${c.name}</span>
        <span class="pm-job">${job?.name || c.jobId}</span>
        <span class="pm-lv">Lv.${c.level}</span>
      </div>
      <div class="pm-bars">
        <span>HP</span>
        <div class="bar-bg"><div class="bar hp-bar" style="width:${Math.max(0,c.hp/c.maxHp*100)}%"></div></div>
        <span class="pm-hp">${c.hp}/${c.maxHp}</span>
        ${c.maxMp > 0 ? `<span>MP</span><div class="bar-bg"><div class="bar mp-bar" style="width:${Math.max(0,c.mp/c.maxMp*100)}%"></div></div><span class="pm-hp">${c.mp}/${c.maxMp}</span>` : ''}
      </div>
      <div class="pm-status ${c.status !== 'ok' ? 'bad' : ''}">${statusLabel(c.status)}</div>
    `;
    list.appendChild(div);
  });
}

function renderGold() {
  const el = document.getElementById('camp-gold');
  if (el) el.textContent = `G: ${Party.gold}`;
}

function statusLabel(s) {
  const map = { ok:'正常', poisoned:'毒', asleep:'眠り', paralyzed:'麻痺', stoned:'石化', dead:'死亡', ashes:'灰' };
  return map[s] || s;
}
