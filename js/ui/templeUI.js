// js/ui/templeUI.js — 寺院：蘇生・治療
import { Party, DB, showScreen } from '../gameState.js';
import { isAlive } from '../character.js';

// 蘇生費用テーブル
const REVIVE_COST  = { dead: 200, ashes: 500, stoned: 100, poisoned: 50, asleep: 30, paralyzed: 80 };
const REVIVE_LABEL = { dead: '蘇生', ashes: '復元', stoned: '石化解除', poisoned: '解毒', asleep: '覚醒', paralyzed: '麻痺解除' };

let _selectedIdx = -1;

export function initTempleUI() {
  const el = document.getElementById('screen-temple');
  document.getElementById('btn-temple-back').addEventListener('click', () => showScreen('town'));

  return {
    show() {
      el.style.display = 'flex';
      _selectedIdx = -1;
      renderRoster();
    },
    hide() { el.style.display = 'none'; },
  };
}

function renderRoster() {
  const container = document.getElementById('temple-roster');
  const msg = document.getElementById('temple-msg');
  if (!container) return;
  container.innerHTML = '';

  // 要治療のキャラを表示（全ロスターから）
  const needHelp = Party.roster.filter(c => c.status !== 'ok');

  if (needHelp.length === 0) {
    container.innerHTML = '<div style="color:#504060;font-size:0.82rem;padding:12px;">治療が必要な者はいません。</div>';
    msg.textContent = '「皆、健康そうですね。神のご加護を。」';
    return;
  }

  msg.textContent = '「神の御加護によって、死者を蘇らせることができます。費用はかかりますが…」';

  needHelp.forEach((c, i) => {
    const realIdx = Party.roster.indexOf(c);
    const job = DB.jobs[c.jobId];
    const cost = REVIVE_COST[c.status] ?? 100;
    const label = REVIVE_LABEL[c.status] ?? '治療';

    const div = document.createElement('div');
    div.className = 'party-member dead';
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
    div.querySelector('button').addEventListener('click', e => {
      e.stopPropagation();
      doHeal(realIdx, cost, c.status);
    });
    container.appendChild(div);
  });
}

function doHeal(rosterIdx, cost, status) {
  const c = Party.roster[rosterIdx];
  if (!c) return;
  const msg = document.getElementById('temple-msg');

  if (Party.gold < cost) {
    msg.textContent = `「費用が足りません。${cost}Gが必要です。」`;
    return;
  }

  // 蘇生失敗チェック（灰からの復元は50%失敗）
  if (status === 'ashes' && Math.random() < 0.5) {
    Party.gold -= cost;
    msg.textContent = `「…${c.name}は、神の加護を受けることができませんでした。(${cost}G消費)」`;
    renderRoster();
    return;
  }

  Party.gold -= cost;
  c.status = 'ok';
  if (status === 'dead' || status === 'ashes') {
    // 蘇生時はHP1で復活
    c.hp = 1;
  }
  msg.textContent = `「${c.name}は無事に${REVIVE_LABEL[status] || '治療'}されました。」`;
  renderRoster();
}

function statusLabel(s) {
  const map = { ok:'正常', poisoned:'毒', asleep:'眠り', paralyzed:'麻痺', stoned:'石化', dead:'死亡', ashes:'灰' };
  return map[s] || s;
}
