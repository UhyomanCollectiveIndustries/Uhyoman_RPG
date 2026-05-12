// ============================================================
// js/ui/townUI.js — 街ハブ画面
// ============================================================
// このファイルの役割：
//   ゲームの拠点となる「街の広場」画面の制御を行います。
//
// 主な機能：
//   1. 各施設（酒場・寺院・城・店・外）へのナビゲーションボタン
//   2. ボタンホバーで施設の説明を情報パネルに表示
//   3. Three.js の3D城下町背景（townBackground.js）の開始・停止
//   4. 所持金バッジとパーティメンバーのステータスバーを表示
// ============================================================
import { Party, DB, showScreen } from '../gameState.js';
import { isAlive } from '../character.js';
import { initTownBackground } from './townBackground.js';

// Three.js 背景を管理するオブジェクト（一度だけ初期化して使い回す）
let bg = null;

// 各施設ボタンのホバー時に表示する情報データ
// title: 大見出し, sub: サブタイトル, desc: 説明文
const LOC_DATA = {
  tavern:  { title: '酒　場',   sub: '― Tavern ―',   desc: '冒険者の登録とパーティ編成を行う場所。最大6人のメンバーで旅に臨もう。新人も歓迎。' },
  temple:  { title: '寺　院',   sub: '― Temple ―',   desc: '神官が傷ついた旅人を癒す聖域。死亡・石化・呪いなど、ダンジョンで受けた深い傷を治療できる。費用が必要。' },
  castle:  { title: 'お　城',   sub: '― Castle ―',   desc: '国王アルベルトが待つ城。旅の目的である《混沌のアミュレット》の奪還についての詳細を聞くことができる。' },
  outside: { title: '外に出る', sub: '― Outside ―',  desc: 'ダンジョンへの入口と訓練場がある。準備が整ったらダンジョンへ向かおう。訓練場では新たな冒険者を育成できる。' },
  shop:    { title: '商　店',   sub: '― Trading Post ―', desc: '熟練の商人が営む店。武器・防具・アイテムの売買に加え、ダンジョンで拾った未鑑定品の鑑定サービスも提供。' },
};

/**
 * 街ハブ画面を初期化して show/hide を持つオブジェクトを返す
 * main.js から1回だけ呼ばれる
 */
export function initTownUI() {
  const el = document.getElementById('screen-town');

  // Three.js 背景を初期化（一度だけ作成して bg に保持する）
  // ??= は「null か undefined のときだけ右辺を代入する」演算子
  bg = initTownBackground();

  // 施設ナビゲーションボタン（クリック + ホバーイベント）
  const navBtns = document.querySelectorAll('.town-nav-btn'); // 全ナビボタンを一括取得
  navBtns.forEach(btn => {
    const loc = btn.dataset.loc; // HTML の data-loc 属性（例: "tavern"）を取得

    // クリック → 対応する施設画面へ遷移
    btn.addEventListener('click', () => showScreen(loc));

    // マウスが乗ったとき → 情報パネルを更新し、そのボタンをアクティブにする
    btn.addEventListener('mouseenter', () => {
      updateInfoPanel(LOC_DATA[loc]);
      document.getElementById('town-nav-hint').textContent = `${LOC_DATA[loc].title} へ向かう`;
      // toggle(class, 条件) = 条件が true なら追加、false なら削除
      navBtns.forEach(b => b.classList.toggle('active', b === btn));
    });

    // マウスが離れたとき → 情報パネルをデフォルト状態に戻す
    btn.addEventListener('mouseleave', () => {
      document.getElementById('town-nav-hint').textContent = '場所を選んでください';
      navBtns.forEach(b => b.classList.remove('active'));
      resetInfoPanel();
    });
  });

  return {
    show() {
      el.style.display = 'block';
      if (bg) bg.start();   // Three.js アニメーションループを開始
      resetInfoPanel();
      renderGold();         // 所持金バッジを更新
      renderPartyBar();     // パーティメンバーバーを更新
    },
    hide() {
      el.style.display = 'none';
      if (bg) bg.stop();    // 非表示中はレンダリングを停止してリソース節約
    },
  };
}

/**
 * 情報パネルに施設データを反映させる
 * @param {object} data - LOC_DATA のエントリー { title, sub, desc }
 */
function updateInfoPanel(data) {
  document.getElementById('town-info-title').textContent = data.title;
  document.getElementById('town-info-sub').textContent   = data.sub;
  document.getElementById('town-info-desc').textContent  = data.desc;
}

/**
 * 情報パネルをデフォルト（「街の広場」）に戻す
 */
function resetInfoPanel() {
  document.getElementById('town-info-title').textContent = 'THREDRY の街';
  document.getElementById('town-info-sub').textContent   = '― 街の広場 ―';
  document.getElementById('town-info-desc').textContent  = 'ここはThredryの街の中心広場です。各施設に立ち寄り、旅の準備を整えましょう。どこへ向かいますか？';
  document.getElementById('town-nav-hint').textContent   = '場所を選んでください';
}

/**
 * 所持金バッジの数値を Party.gold に合わせて更新する
 */
function renderGold() {
  const el = document.getElementById('town-gold-amount');
  if (el) el.textContent = Party.gold;
}

/**
 * パーティメンバーの名前・職業・HP を横一列バーに表示する
 * メンバーが0人のときは「パーティなし」メッセージを表示
 */
function renderPartyBar() {
  const bar = document.getElementById('town-party-bar');
  if (!bar) return;
  bar.innerHTML = ''; // 既存の表示をクリア

  if (Party.members.length === 0) {
    // メンバーがいない場合のメッセージ
    const tip = document.createElement('div');
    tip.className = 'town-party-chip';
    tip.textContent = 'パーティなし — 酒場でメンバーを編成';
    bar.appendChild(tip);
    return;
  }

  // メンバーごとにチップ（バッジ）を作成して並べる
  Party.members.forEach(c => {
    const chip = document.createElement('div');
    // 死亡中は 'dead' クラスを追加してグレー表示にする
    chip.className = 'town-party-chip' + (isAlive(c) ? '' : ' dead');
    const job = DB.jobs[c.jobId];
    chip.textContent = `${c.name} (${job?.name || c.jobId}) Lv.${c.level}  HP ${c.hp}/${c.maxHp}`;
    bar.appendChild(chip);
  });
}


