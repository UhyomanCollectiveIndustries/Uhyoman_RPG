// js/gameState.js — グローバルなゲーム状態

export const DB = {
  jobs: {},
  weapons: {},
  armors: {},
  items: {},
  spells: {},
  monsters: {},
  maps: {},   // { 1: [[]], 2: [[]], ... }
};

export const Party = {
  roster:  [],   // 登録済み全キャラクター（酒場で管理）
  members: [],   // 現在のパーティ（最大6人）
  gold: 500,     // 所持金（初期500G）
  floor: 1,
  pos: { x: 1, z: 1 },     // ダンジョン内座標
  dir: 0,                   // 0=North 1=East 2=South 3=West
};

/** 画面切替 */
export const Screens = {};   // 登録された画面ハンドラ { id: { show(), hide() } }
let _currentScreen = null;

export function registerScreen(id, handlers) {
  Screens[id] = handlers;
}

export function showScreen(id) {
  if (_currentScreen && Screens[_currentScreen]) Screens[_currentScreen].hide?.();
  _currentScreen = id;
  if (Screens[id]) Screens[id].show?.();
}

export function currentScreen() { return _currentScreen; }
