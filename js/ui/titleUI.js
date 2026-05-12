// ============================================================
// js/ui/titleUI.js — タイトル画面
// ============================================================
// このファイルの役割：
//   ゲーム起動直後に表示される「タイトル画面」の制御を行います。
//
// 主な処理：
//   1. 画面に漂う光のパーティクル（星の粒のような演出）を生成する
//   2. 「ゲーム開始」ボタンが押されたら街画面に移動する
//
// 「パーティクル」とは？
//   画面上でランダムな位置・速度・サイズで動く小さな要素のこと。
//   CSS アニメーションで動かしているため、JS からは配置のみ行います。
// ============================================================
import { showScreen } from '../gameState.js';

/**
 * タイトル画面を初期化して show/hide を持つオブジェクトを返す
 * main.js から1回だけ呼ばれる
 */
export function initTitleUI() {
  const el = document.getElementById('screen-title');

  // ─── パーティクル（光の粒）を生成 ───
  const pc = document.getElementById('title-particles');
  for (let i = 0; i < 50; i++) {
    const p = document.createElement('div'); // <div> を新しく作る
    p.className = 'particle'; // CSS で星型のスタイルを適用済み

    // インラインスタイルで位置・サイズ・アニメーション速度をランダムに設定
    // cssText = CSS プロパティをまとめて文字列で書ける省略記法
    p.style.cssText = [
      `left:${Math.random()*100}vw`,                     // 横位置: 0〜100% の幅に散らす
      `animation-duration:${7+Math.random()*8}s`,        // 動く速さ: 7〜15秒でランダム
      `animation-delay:${Math.random()*10}s`,            // 開始遅延: 0〜10秒（一斉に動かない）
      `width:${1+Math.random()*2}px`,                    // 幅: 1〜3px（小さい粒）
      `height:${1+Math.random()*2}px`,                   // 高さ: 1〜3px
    ].join(';');

    pc.appendChild(p); // 親要素に追加して画面に表示
  }

  // 「ゲームをはじめる」ボタンがクリックされたら街画面へ移動
  document.getElementById('btn-new-game').addEventListener('click', () => showScreen('town'));

  // 外部（main.js/gameState.js）から呼ばれる show/hide メソッドを返す
  return {
    show() { el.style.display = 'flex'; }, // 表示する（CSS の flex レイアウト）
    hide() { el.style.display = 'none'; }, // 非表示にする
  };
}
