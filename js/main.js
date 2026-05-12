// ============================================================
// js/main.js — アプリケーションのエントリーポイント（起動口）
// ============================================================
// このファイルが最初に実行されます。
// 役割：
//   1. テキストファイル (data/*.txt) からゲームデータを読み込む
//   2. 各画面 (title, town, tavern ...) を初期化して登録する
//   3. タイトル画面を表示してゲームを開始する
//
// 「エントリーポイント」= プログラムの入り口という意味です。
// ============================================================

// --- 他のファイルから必要な関数・変数をインポートする ---
// import 文：他のファイルで export された内容を使えるようにする書き方
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

// --- ローディング画面の表示・非表示 ---
// データ読み込み中にユーザーに進捗を見せるための画面です。

/**
 * ローディングメッセージを画面中央に表示する
 * @param {string} msg - 表示するテキスト
 */
function showLoading(msg) {
  // すでに要素があればそれを使い、なければ新しく作る
  let el = document.getElementById('_loading');
  if (!el) {
    el = document.createElement('div');
    el.id = '_loading';
    // CSS を直接指定して全画面オーバーレイにする
    el.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0008;color:#b090d0;font-size:1.2rem;letter-spacing:0.2em;z-index:999;font-family:monospace;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
}

/**
 * ローディング画面を消す
 */
function hideLoading() {
  const el = document.getElementById('_loading');
  if (el) el.remove(); // DOM から要素を削除する
}

// --- メイン処理 ---
// async 関数：非同期処理（時間のかかる処理）を await で待てる関数

async function main() {
  showLoading('Loading…');
  try {
    // ---------------------------------------------------
    // ステップ1: データファイルを全部同時に読み込む
    // Promise.all = 複数の非同期処理を並列で実行し、全部終わるまで待つ
    // ---------------------------------------------------
    const [jobs, weapons, armors, items, spells, monsters, maps] = await Promise.all([
      loadJobs(),      // 職業データ (jobs.txt)
      loadWeapons(),   // 武器データ (weapons.txt)
      loadArmors(),    // 防具データ (armors.txt)
      loadItems(),     // アイテムデータ (items.txt)
      loadSpells(),    // 呪文データ (spells.txt)
      loadMonsters(),  // モンスターデータ (monsters.txt)
      loadMaps(),      // マップデータ (maps.txt)
    ]);

    // 読み込んだデータを DB（グローバルなデータ置き場）に格納する
    // Object.assign = 第1引数のオブジェクトに第2引数の中身を上書きコピーする
    Object.assign(DB.jobs,     jobs);
    Object.assign(DB.weapons,  weapons);
    Object.assign(DB.armors,   armors);
    Object.assign(DB.items,    items);
    Object.assign(DB.spells,   spells);
    Object.assign(DB.monsters, monsters);
    Object.assign(DB.maps,     maps);

    // ---------------------------------------------------
    // ステップ2: 各画面を初期化して gameState に登録する
    // initXxxUI() = HTML 要素にイベントを設定し、show/hide を返す
    // registerScreen(id, handlers) = id で画面切替できるよう登録
    // ---------------------------------------------------
    initCharCreateModal();   // キャラ作成モーダルを一度だけ初期化（イベント登録）

    registerScreen('title',   initTitleUI());    // タイトル画面
    registerScreen('town',    initTownUI());     // 街ハブ画面
    registerScreen('tavern',  initTavernUI());   // 酒場
    registerScreen('temple',  initTempleUI());   // 寺院
    registerScreen('castle',  initCastleUI());   // 城
    registerScreen('shop',    initShopUI());     // 商店
    registerScreen('outside', initOutsideUI());  // 外（ダンジョン入口）
    registerScreen('dungeon', initDungeonUI());  // ダンジョン探索
    registerScreen('battle',  initBattleUI());   // バトル

    // ---------------------------------------------------
    // ステップ3: ゲーム開始
    // ---------------------------------------------------
    hideLoading();
    showScreen('title'); // タイトル画面を表示する

  } catch (err) {
    // 読み込みやその他のエラーが起きたときにメッセージを表示する
    console.error(err);
    showLoading(`エラー: ${err.message}`);
  }
}

// main 関数を呼び出してゲームを起動する
// .catch(console.error) = 予期しないエラーをコンソールに出力する
main().catch(console.error);
