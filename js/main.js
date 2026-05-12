// js/main.js — エントリーポイント
import { loadJobs, loadWeapons, loadArmors, loadItems, loadSpells, loadMonsters, loadMaps } from './dataLoader.js';
import { DB, registerScreen, showScreen } from './gameState.js';
import { initTitleUI }   from './ui/titleUI.js';
import { initTownUI }    from './ui/townUI.js';
import { initTavernUI }  from './ui/tavernUI.js';
import { initTempleUI }  from './ui/templeUI.js';
import { initCastleUI }  from './ui/castleUI.js';
import { initShopUI }    from './ui/shopUI.js';
import { initOutsideUI } from './ui/outsideUI.js';
import { initDungeonUI } from './ui/dungeonUI.js';
import { initBattleUI }  from './ui/battleUI.js';
import { initCharCreateModal } from './ui/charCreateModal.js';

// ロード中メッセージ
function showLoading(msg) {
  let el = document.getElementById('_loading');
  if (!el) {
    el = document.createElement('div');
    el.id = '_loading';
    el.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0008;color:#b090d0;font-size:1.2rem;letter-spacing:0.2em;z-index:999;font-family:monospace;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
}
function hideLoading() {
  const el = document.getElementById('_loading');
  if (el) el.remove();
}

async function main() {
  showLoading('Loading…');
  try {
    // データ読み込み
    const [jobs, weapons, armors, items, spells, monsters, maps] = await Promise.all([
      loadJobs(), loadWeapons(), loadArmors(), loadItems(), loadSpells(), loadMonsters(), loadMaps(),
    ]);
    Object.assign(DB.jobs,     jobs);
    Object.assign(DB.weapons,  weapons);
    Object.assign(DB.armors,   armors);
    Object.assign(DB.items,    items);
    Object.assign(DB.spells,   spells);
    Object.assign(DB.monsters, monsters);
    Object.assign(DB.maps,     maps);

    // 画面初期化 & 登録
    initCharCreateModal();   // モーダル共通ハンドラを一度だけ初期化
    registerScreen('title',   initTitleUI());
    registerScreen('town',    initTownUI());
    registerScreen('tavern',  initTavernUI());
    registerScreen('temple',  initTempleUI());
    registerScreen('castle',  initCastleUI());
    registerScreen('shop',    initShopUI());
    registerScreen('outside', initOutsideUI());
    registerScreen('dungeon', initDungeonUI());
    registerScreen('battle',  initBattleUI());

    hideLoading();
    showScreen('title');
  } catch (err) {
    console.error(err);
    showLoading(`エラー: ${err.message}`);
  }
}

main().catch(console.error);
