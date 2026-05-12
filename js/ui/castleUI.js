// ============================================================
// js/ui/castleUI.js — お城：旅の目的・王の言葉
// ============================================================
// このファイルの役割：
//   はじめに寻れるお城画面を制御します。
//   国王のダイアログをページ毎に表示し、クリックで次の言葉へ進めます。
//   ゲームの目的（アミュレット奉還）が番号で明かされます。
//
// ダイアログシステム：
//   DIALOGUES 配列の各要素が1ページ分の台詞です。
//   クリックのたびに _dialogIdx が「順に1進んで最後まで行ったら最初に戻る」
//   これを「周回」または「ループ」と言います。
// ============================================================
import { showScreen } from '../gameState.js';
import { initLocationBackground } from './locationBackground.js';

// Three.js ロケーション背景オブジェクト
let _bg = null;

// 国王の径詞（複数ページ分）
// \n は改行文字。画面に表示すると複数行になります。
const DIALOGUES = [
  '「勇者たちよ、よくぞ参った。\n我が王国は今、深刻な危機に矕している。」',
  '「城の地下深く、魔術師ワードナーが\n強大な魔力を蓄え、我々を脅かしている。」',
  '「彼が地下10層に隠し持つ\n《混沌のアミュレット》を取り戻せ。」',
  '「地下には幾多の魔物が潜んでいる。\n慎重に探索し、生き延びよ。」',
  '「貴者たちの活躍を期待している。\n…神のご加護があらんことを。」',
];

// 現在表示中のダイアログのインデックス（0スタート）
let _dialogIdx = 0;

/**
 * お城画面を初期化して show/hide を返す
 */
export function initCastleUI() {
  const el = document.getElementById('screen-castle');
  document.getElementById('btn-castle-back').addEventListener('click', () => showScreen('town'));

  return {
    show() {
      el.style.display = 'flex';
      _bg ??= initLocationBackground('castle'); // 初回表示時にだけ初期化
      if (_bg) _bg.start();
      _dialogIdx = 0; // 画面表示時に最初の台詞からはじめる
      renderCastle();
    },
    hide() { el.style.display = 'none'; if (_bg) _bg.stop(); },
  };
}

/**
 * お城画面のコンテンツを描画する
 * - 王の台詞パネル（クリックで次の言葉へ）
 * - クエスト目標パネル
 */
function renderCastle() {
  const dialogEl = document.getElementById('castle-dialogue');
  const objEl    = document.getElementById('castle-objective');
  if (!dialogEl || !objEl) return;

  // 現在のインデックスの台詞を表示
  dialogEl.textContent = DIALOGUES[_dialogIdx];
  dialogEl.style.cursor = 'pointer'; // クリックできることをマウスカーソルで示す
  dialogEl.title = 'クリックで次の言葉へ'; // ツールチップ

  // addEventListener は一度だけ登録するようにする
  // dataset.bound で「登録済み」フラグを締切る
  // （二重登録するとクリック1回に2ページ進んでしまう）
  if (!dialogEl.dataset.bound) {
    dialogEl.dataset.bound = '1';
    dialogEl.addEventListener('click', () => {
      // % 演算子 = 剰り算 → 最後のページを超えたら 0 に戻る（ループ）
      _dialogIdx = (_dialogIdx + 1) % DIALOGUES.length;
      dialogEl.textContent = DIALOGUES[_dialogIdx];
    });
  }

  // クエスト目標・ルール説明テキストを設定
  objEl.textContent = `
目　的：
  地下迷宮の最深部 (10F) に潜む
  魔術師ワードナーを倒し、
  《混沌のアミュレット》を取り返せ。

報　酬：
  アミュレット奪還で王国の平和が回復し、
  冒険者たちは英雄として譛えられる。

注　意：
  ・パーティ全滅時はゲームオーバー
  ・全滅したキャラは寺院で蘇生可能
  ・準備を十分に整えてから挑め
  `.trim();
}
