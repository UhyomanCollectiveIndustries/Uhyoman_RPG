// js/ui/townUI.js — 街ハブ画面
import { Party, DB, showScreen } from '../gameState.js';
import { isAlive } from '../character.js';
import { initTownBackground } from './townBackground.js';

let bg = null;

// 各ボタンにホバーで情報パネルを更新するデータ
const LOC_DATA = {
  tavern:  { title: '酒　場',   sub: '― Tavern ―',   desc: '冒険者の登録とパーティ編成を行う場所。最大6人のメンバーで旅に臨もう。新人も歓迎。' },
  temple:  { title: '寺　院',   sub: '― Temple ―',   desc: '神官が傷ついた旅人を癒す聖域。死亡・石化・呪いなど、ダンジョンで受けた深い傷を治療できる。費用が必要。' },
  castle:  { title: 'お　城',   sub: '― Castle ―',   desc: '国王アルベルトが待つ城。旅の目的である《混沌のアミュレット》の奪還についての詳細を聞くことができる。' },
  outside: { title: '外に出る', sub: '― Outside ―',  desc: 'ダンジョンへの入口と訓練場がある。準備が整ったらダンジョンへ向かおう。訓練場では新たな冒険者を育成できる。' },
  shop:    { title: '商　店',   sub: '― Trading Post ―', desc: '熟練の商人が営む店。武器・防具・アイテムの売買に加え、ダンジョンで拾った未鑑定品の鑑定サービスも提供。' },
};

export function initTownUI() {
  const el = document.getElementById('screen-town');

  // Three.js 背景を初期化（一度だけ）
  bg = initTownBackground();

  // ボタン：クリックで画面遷移、ホバーで情報更新
  const navBtns = document.querySelectorAll('.town-nav-btn');
  navBtns.forEach(btn => {
    const loc = btn.dataset.loc;
    btn.addEventListener('click', () => showScreen(loc));
    btn.addEventListener('mouseenter', () => {
      updateInfoPanel(LOC_DATA[loc]);
      document.getElementById('town-nav-hint').textContent = `${LOC_DATA[loc].title} へ向かう`;
      navBtns.forEach(b => b.classList.toggle('active', b === btn));
    });
    btn.addEventListener('mouseleave', () => {
      document.getElementById('town-nav-hint').textContent = '場所を選んでください';
      navBtns.forEach(b => b.classList.remove('active'));
      resetInfoPanel();
    });
  });

  return {
    show() {
      el.style.display = 'block';
      if (bg) bg.start();
      resetInfoPanel();
      renderGold();
      renderPartyBar();
    },
    hide() {
      el.style.display = 'none';
      if (bg) bg.stop();
    },
  };
}

function updateInfoPanel(data) {
  document.getElementById('town-info-title').textContent = data.title;
  document.getElementById('town-info-sub').textContent   = data.sub;
  document.getElementById('town-info-desc').textContent  = data.desc;
}

function resetInfoPanel() {
  document.getElementById('town-info-title').textContent = 'THREDRY の街';
  document.getElementById('town-info-sub').textContent   = '― 街の広場 ―';
  document.getElementById('town-info-desc').textContent  = 'ここはThredryの街の中心広場です。各施設に立ち寄り、旅の準備を整えましょう。どこへ向かいますか？';
  document.getElementById('town-nav-hint').textContent   = '場所を選んでください';
}

function renderGold() {
  const el = document.getElementById('town-gold-amount');
  if (el) el.textContent = Party.gold;
}

function renderPartyBar() {
  const bar = document.getElementById('town-party-bar');
  if (!bar) return;
  bar.innerHTML = '';
  if (Party.members.length === 0) {
    const tip = document.createElement('div');
    tip.className = 'town-party-chip';
    tip.textContent = 'パーティなし — 酒場でメンバーを編成';
    bar.appendChild(tip);
    return;
  }
  Party.members.forEach(c => {
    const chip = document.createElement('div');
    chip.className = 'town-party-chip' + (isAlive(c) ? '' : ' dead');
    const job = DB.jobs[c.jobId];
    chip.textContent = `${c.name} (${job?.name || c.jobId}) Lv.${c.level}  HP ${c.hp}/${c.maxHp}`;
    bar.appendChild(chip);
  });
}
