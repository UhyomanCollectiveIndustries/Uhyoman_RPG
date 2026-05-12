// js/ui/titleUI.js — タイトル画面
import { showScreen } from '../gameState.js';

export function initTitleUI() {
  const el = document.getElementById('screen-title');

  // パーティクル
  const pc = document.getElementById('title-particles');
  for (let i = 0; i < 50; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `left:${Math.random()*100}vw;animation-duration:${7+Math.random()*8}s;animation-delay:${Math.random()*10}s;width:${1+Math.random()*2}px;height:${1+Math.random()*2}px;`;
    pc.appendChild(p);
  }

  document.getElementById('btn-new-game').addEventListener('click', () => showScreen('town'));

  return {
    show() { el.style.display = 'flex'; },
    hide() { el.style.display = 'none'; },
  };
}
