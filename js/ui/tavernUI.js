// js/ui/tavernUI.js — 酒場：冒険者登録・パーティ編成
import { Party, DB, showScreen } from '../gameState.js';
import { isAlive } from '../character.js';
import { openCharCreateModal } from './charCreateModal.js';
import { initLocationBackground } from './locationBackground.js';

let _bg = null;

// 選択中のロスター冒険者インデックス
let _selectedRosterIdx = -1;

export function initTavernUI() {
  const el = document.getElementById('screen-tavern');

  document.getElementById('btn-tavern-back').addEventListener('click', () => showScreen('town'));

  document.getElementById('btn-tavern-new-char').addEventListener('click', () => {
    openCharCreateModal(char => {
      Party.roster.push(char);
      renderAll();
    });
  });

  document.getElementById('btn-tavern-add-party').addEventListener('click', () => {
    if (_selectedRosterIdx < 0) { alert('冒険者を選択してください。'); return; }
    const char = Party.roster[_selectedRosterIdx];
    if (!char) return;
    if (!isAlive(char)) { alert('死亡・石化した冒険者はパーティに加えられません。'); return; }
    if (Party.members.includes(char)) { alert('すでにパーティにいます。'); return; }
    if (Party.members.length >= 6) { alert('パーティは最大6人です。'); return; }
    Party.members.push(char);
    _selectedRosterIdx = -1;
    renderAll();
  });

  document.getElementById('btn-tavern-remove-party').addEventListener('click', () => {
    if (Party.members.length === 0) return;
    Party.members.pop();
    renderAll();
  });

  return {
    show() {
      el.style.display = 'flex';
      _bg ??= initLocationBackground('tavern');
      if (_bg) _bg.start();
      _selectedRosterIdx = -1;
      renderAll();
    },
    hide() { el.style.display = 'none'; if (_bg) _bg.stop(); },
  };
}

// ---- 内部描画 ----

function renderAll() {
  renderParty();
  renderRoster();
}

function renderParty() {
  const list = document.getElementById('tavern-party-list');
  const cnt  = document.getElementById('tavern-party-count');
  if (!list) return;
  cnt.textContent = `(${Party.members.length}/6)`;
  list.innerHTML = '';
  Party.members.forEach((c, i) => {
    const job = DB.jobs[c.jobId];
    const div = document.createElement('div');
    div.className = 'party-member' + (isAlive(c) ? '' : ' dead');
    div.innerHTML = buildMemberHTML(c, i + 1, job);
    list.appendChild(div);
  });
  if (Party.members.length === 0) {
    list.innerHTML = '<div style="color:#504060;font-size:0.78rem;padding:10px;">パーティは空です</div>';
  }
}

function renderRoster() {
  const list = document.getElementById('tavern-roster-list');
  const cnt  = document.getElementById('tavern-roster-count');
  if (!list) return;
  cnt.textContent = `(${Party.roster.length})`;
  list.innerHTML = '';
  Party.roster.forEach((c, i) => {
    const job = DB.jobs[c.jobId];
    const inParty = Party.members.includes(c);
    const div = document.createElement('div');
    div.className = 'roster-member'
      + (isAlive(c) ? '' : ' dead')
      + (inParty ? ' in-party' : '')
      + (_selectedRosterIdx === i ? ' selected' : '');
    div.innerHTML = buildMemberHTML(c, i + 1, job)
      + (inParty ? '<div style="font-size:0.7rem;color:#60c060;margin-top:3px;">✔ パーティ中</div>' : '');
    div.addEventListener('click', () => {
      _selectedRosterIdx = (_selectedRosterIdx === i) ? -1 : i;
      renderRoster();
    });
    list.appendChild(div);
  });
  if (Party.roster.length === 0) {
    list.innerHTML = '<div style="color:#504060;font-size:0.78rem;padding:10px;">冒険者がいません<br>「新規登録」で作成してください</div>';
  }
}

function buildMemberHTML(c, num, job) {
  const hpPct = Math.max(0, c.hp / c.maxHp * 100);
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

function statusLabel(s) {
  const map = { ok:'正常', poisoned:'毒', asleep:'眠り', paralyzed:'麻痺', stoned:'石化', dead:'死亡', ashes:'灰' };
  return map[s] || s;
}
