// ============================================================
// js/ui/outsideUI.js — 外に出る：ダンジョン入口・訓練場
// ============================================================
// このファイルの役割：
//   街の外側の画面を制御します。
//   2つの入口があります：
//     1. 「ダンジョンへ」ボタン: 生存パーティがいればダンジョン画面へ進む
//     2. 「訓練場」ボタン: キャラクター作成モーダルを開いて新規キャラを登録する
//
// ダンジョン入場制限：
//   パーティに生存しているメンバーが 0 人の場合、
//   警告ダイアログを表示して中に進めない。
//   パーティ編成は酒場（tavernUI）で行う。
// ============================================================
import { Party, showScreen } from '../gameState.js';
import { isAlive } from '../character.js';
import { openCharCreateModal } from './charCreateModal.js';

/**
 * 「外に出る」画面を初期化して show/hide を返す
 */
export function initOutsideUI() {
  const el = document.getElementById('screen-outside');

  // 戻るボタン → 街画面へ
  document.getElementById('btn-outside-back').addEventListener('click', () => showScreen('town'));

  // ダンジョンへボタン
  document.getElementById('btn-outside-dungeon').addEventListener('click', () => {
    // 生存パーティエントリーチェック
    // filter(isAlive) → isAlive が true を返すケラスだけ抽出
    const alive = Party.members.filter(isAlive);
    if (alive.length === 0) {
      // 生存者がいなければ入場不可
      alert('生存しているパーティメンバーがいません！\n酒場でパーティを編成してください。');
      return;
    }
    showScreen('dungeon'); // ダンジョン画面へ進む
  });

  // 訓練場ボタン → キャラクター作成モーダルを開く
  document.getElementById('btn-outside-training').addEventListener('click', () => {
    // openCharCreateModal にコールバックを渡す：
    // 作成完了後にロスターに追加される
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

// 以下は旧コード（現在は使われていないレガシー関数）
// charCreateModal.js に統合されたため、こちらの関数は呼び出されていません。
// 未来的に削除予定。

