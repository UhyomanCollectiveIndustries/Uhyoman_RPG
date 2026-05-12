// js/ui/battleUI.js — Wizardry風コマンド式バトル画面
import { Party, DB } from '../gameState.js';
import { registerCommand, battleContinue } from '../battle.js';
import { isActive } from '../character.js';

export function initBattleUI() {
  const el = document.getElementById('screen-battle');
  return {
    show() { el.style.display = 'flex'; },
    hide() { el.style.display = 'none'; },
  };
}

/**
 * renderBattle — battle.js から呼ばれる描画関数
 */
export function renderBattle({ enemies, log, phase, cmdIndex, cmds, win, fled }) {
  renderEnemies(enemies);
  renderLog(log);
  renderPartyStrip();

  const cmdPanel = document.getElementById('b-command-panel');
  const resultPanel = document.getElementById('b-result-panel');

  if (phase === 'command') {
    cmdPanel.style.display = 'flex';
    resultPanel.style.display = 'none';
    renderCommandPanel(cmdIndex, enemies);
  } else if (phase === 'result') {
    cmdPanel.style.display = 'none';
    resultPanel.style.display = 'flex';
    const msg = fled ? '逃げ出した！' : win ? '勝利！' : '全滅…';
    document.getElementById('b-result-msg').textContent = msg;
    document.getElementById('btn-b-continue').onclick = () => battleContinue();
  } else {
    cmdPanel.style.display = 'none';
    resultPanel.style.display = 'none';
  }
}

function renderEnemies(enemies) {
  const zone = document.getElementById('b-enemy-zone');
  zone.innerHTML = '';
  enemies.forEach((e, i) => {
    const div = document.createElement('div');
    div.className = 'b-enemy' + (e.hp <= 0 ? ' dead' : '');
    div.innerHTML = `
      <div class="b-enemy-name">${e.name}</div>
      <div class="bar-bg"><div class="bar hp-bar" style="width:${Math.max(0,e.hp/e.maxHp*100)}%"></div></div>
      <div class="b-enemy-hp">${e.hp <= 0 ? '倒れた' : `HP ${e.hp}`}</div>
    `;
    zone.appendChild(div);
  });
}

function renderLog(log) {
  const el = document.getElementById('b-log');
  el.innerHTML = '';
  const recent = log.slice(-8);
  for (const line of recent) {
    const p = document.createElement('div');
    p.className = 'b-log-line';
    p.textContent = line;
    el.appendChild(p);
  }
  el.scrollTop = el.scrollHeight;
}

function renderPartyStrip() {
  const el = document.getElementById('b-party-strip');
  el.innerHTML = '';
  Party.members.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'b-party-member' + (isActive(c) ? '' : ' dead');
    const job = DB.jobs[c.jobId];
    div.innerHTML = `
      <div class="bpm-name">${c.name}<span class="bpm-job">${job?.name||''}</span></div>
      <div class="bpm-hp">${c.hp}/${c.maxHp} HP</div>
      <div class="bar-bg"><div class="bar hp-bar" style="width:${Math.max(0,c.hp/c.maxHp*100)}%"></div></div>
      <div class="bpm-status ${c.status !== 'ok' ? 'bad' : ''}">${statusLabel(c.status)}</div>
    `;
    el.appendChild(div);
  });
}

function renderCommandPanel(cmdIndex, enemies) {
  const char = Party.members[cmdIndex];
  if (!char) return;
  const job = DB.jobs[char.jobId];
  document.getElementById('b-cmd-title').textContent = `${char.name} (${job?.name}) のコマンド`;

  const btns = document.getElementById('b-cmd-btns');
  btns.innerHTML = '';

  addCmdBtn(btns, '攻撃', () => {
    // 生存している最初の敵をターゲット
    const ti = enemies.findIndex(e => e.hp > 0);
    if (ti === -1) return;
    showTargetSelect(enemies, t => registerCommand({ type: 'attack', target: t }));
  });

  if (char.maxMp > 0) {
    addCmdBtn(btns, '呪文', () => {
      showSpellSelect(char, enemies);
    });
  }

  if (char.items.length > 0) {
    addCmdBtn(btns, 'アイテム', () => {
      showItemSelect(char);
    });
  }

  addCmdBtn(btns, '逃げる', () => {
    registerCommand({ type: 'flee' });
  });
}

function addCmdBtn(parent, label, onClick) {
  const btn = document.createElement('button');
  btn.className = 'b-cmd-btn';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  parent.appendChild(btn);
}

function showTargetSelect(enemies, cb) {
  const panel = document.getElementById('b-cmd-btns');
  panel.innerHTML = '<div class="b-sub-title">ターゲット選択</div>';
  enemies.forEach((e, i) => {
    if (e.hp <= 0) return;
    const btn = document.createElement('button');
    btn.className = 'b-cmd-btn';
    btn.textContent = e.name;
    btn.addEventListener('click', () => cb(i));
    panel.appendChild(btn);
  });
}

function showSpellSelect(char, enemies) {
  const availableSpells = Object.values(DB.spells).filter(s =>
    s.jobs.includes(char.jobId) && s.level <= char.level && char.mp >= s.mp_cost
  );
  const panel = document.getElementById('b-cmd-btns');
  panel.innerHTML = '<div class="b-sub-title">呪文選択</div>';
  for (const sp of availableSpells) {
    const btn = document.createElement('button');
    btn.className = 'b-cmd-btn';
    btn.textContent = `${sp.name} (MP:${sp.mp_cost})`;
    btn.addEventListener('click', () => {
      if (sp.target === 'all' || sp.target === 'ally_all') {
        registerCommand({ type: 'spell', spellId: sp.id, target: 0 });
      } else if (sp.target === 'ally' || sp.target === 'self') {
        showAllySelect(t => registerCommand({ type: 'spell', spellId: sp.id, target: t }));
      } else {
        showTargetSelect(enemies, t => registerCommand({ type: 'spell', spellId: sp.id, target: t }));
      }
    });
    panel.appendChild(btn);
  }
}

function showAllySelect(cb) {
  const panel = document.getElementById('b-cmd-btns');
  panel.innerHTML = '<div class="b-sub-title">対象を選択</div>';
  Party.members.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'b-cmd-btn';
    btn.textContent = `${c.name} (${c.hp}/${c.maxHp})`;
    btn.addEventListener('click', () => cb(i));
    panel.appendChild(btn);
  });
}

function showItemSelect(char) {
  const panel = document.getElementById('b-cmd-btns');
  panel.innerHTML = '<div class="b-sub-title">アイテム選択</div>';
  const seen = new Set();
  for (const itemId of char.items) {
    if (seen.has(itemId)) continue;
    seen.add(itemId);
    const item = DB.items[itemId];
    if (!item) continue;
    const btn = document.createElement('button');
    btn.className = 'b-cmd-btn';
    const cnt = char.items.filter(i => i === itemId).length;
    btn.textContent = `${item.name} x${cnt}`;
    btn.addEventListener('click', () => {
      if (item.type === 'heal' || item.type === 'cure' || item.type === 'revive') {
        showAllySelect(t => registerCommand({ type: 'item', itemId, target: t }));
      } else {
        registerCommand({ type: 'item', itemId, target: 0 });
      }
    });
    panel.appendChild(btn);
  }
}

function statusLabel(s) {
  const map = { ok:'正常', poisoned:'毒', asleep:'眠り', paralyzed:'麻痺', stoned:'石化', dead:'死亡', ashes:'灰' };
  return map[s] || s;
}
