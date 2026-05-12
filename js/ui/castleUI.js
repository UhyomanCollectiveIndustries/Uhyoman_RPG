// js/ui/castleUI.js — お城：旅の目的・王の言葉
import { showScreen } from '../gameState.js';

// 王の台詞（複数ページ）
const DIALOGUES = [
  '「勇者たちよ、よくぞ参った。\n我が王国は今、深刻な危機に瀕している。」',
  '「城の地下深く、魔術師ワードナーが\n強大な魔力を蓄え、我々を脅かしている。」',
  '「彼が地下10層に隠し持つ\n《混沌のアミュレット》を取り戻せ。」',
  '「地下には幾多の魔物が潜んでいる。\n慎重に探索し、生き延びよ。」',
  '「貴者たちの活躍を期待している。\n…神のご加護があらんことを。」',
];

let _dialogIdx = 0;

export function initCastleUI() {
  const el = document.getElementById('screen-castle');
  document.getElementById('btn-castle-back').addEventListener('click', () => showScreen('town'));

  return {
    show() {
      el.style.display = 'flex';
      _dialogIdx = 0;
      renderCastle();
    },
    hide() { el.style.display = 'none'; },
  };
}

function renderCastle() {
  const dialogEl = document.getElementById('castle-dialogue');
  const objEl    = document.getElementById('castle-objective');
  if (!dialogEl || !objEl) return;

  // 台詞（クリックで次へ）
  dialogEl.textContent = DIALOGUES[_dialogIdx];
  dialogEl.style.cursor = 'pointer';
  dialogEl.title = 'クリックで次の言葉へ';

  // イベントは一度だけ登録
  if (!dialogEl.dataset.bound) {
    dialogEl.dataset.bound = '1';
    dialogEl.addEventListener('click', () => {
      _dialogIdx = (_dialogIdx + 1) % DIALOGUES.length;
      dialogEl.textContent = DIALOGUES[_dialogIdx];
    });
  }

  objEl.textContent = `
目　的：
  地下迷宮の最深部 (10F) に潜む
  魔術師ワードナーを倒し、
  《混沌のアミュレット》を取り返せ。

報　酬：
  アミュレット奪還で王国の平和が回復し、
  冒険者たちは英雄として讃えられる。

注　意：
  ・パーティ全滅時はゲームオーバー
  ・全滅したキャラは寺院で蘇生可能
  ・準備を十分に整えてから挑め
  `.trim();
}
