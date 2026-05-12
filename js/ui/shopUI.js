// ============================================================
// js/ui/shopUI.js — 商店：購入・売却・鑑定
// ============================================================
// このファイルの役割：
//   武器・防具・アイテムを売買できる「商店」画面の制御を行います。
//
// 3タブ構成：
//   1. 購入（buy）  : DBの全アイテム一覧を表示。クリックで詳細→購入ボタン
//   2. 売却（sell） : パーティメンバーの所持品を一覧。売却価格は購入価格の50%
//   3. 鑑定（identify）: 所持品の詳細情報を確認（鑑定費100G）
//
// 状態変数：
//   _tab: 現在表示中のタブ
//   _selectedKey: 選択中のアイテムを示す文字列キー
//   _selectedCharIdx: 売却・鑑定で対象のパーティメンバーのインデックス
// ============================================================
import { Party, DB, showScreen } from '../gameState.js';
import { isAlive } from '../character.js';
import { initLocationBackground } from './locationBackground.js';

// Three.js ロケーション背景
let _bg  = null;

// 現在表示しているタブ（'buy'|'sell'|'identify'）
let _tab = 'buy';

// リスト内で選択中の商品キー
// 購入タブ: アイテムID、売却タブ: "charIdx_itemIdx"、鑑定タブ: "i_charIdx_itemIdx"
let _selectedKey = null;

// 売却・鑑定時の対象キャラクターのパーティインデックス
let _selectedCharIdx = -1;

/**
 * 商店画面を初期化して show/hide を持つオブジェクトを返す
 */
export function initShopUI() {
  const el = document.getElementById('screen-shop');
  document.getElementById('btn-shop-back').addEventListener('click', () => showScreen('town'));

  // タブボタンのクリックで切り替え
  document.querySelectorAll('.shop-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _tab = btn.dataset.tab;          // クリックされたタブの名前を保存
      _selectedKey = null;             // 選択をリセット
      _selectedCharIdx = -1;
      // すべてのタブから 'active' を外して、クリックされたものだけに付ける
      document.querySelectorAll('.shop-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderShop(); // タブに対応した内容を描画
    });
  });

  return {
    show() {
      el.style.display = 'flex';
      _bg ??= initLocationBackground('shop'); // 初回のみ背景を初期化
      if (_bg) _bg.start();
      _tab = 'buy';       // 表示時はいつも購入タブからスタート
      _selectedKey = null;
      _selectedCharIdx = -1;
      // 購入タブを初期アクティブ状態にする
      document.querySelectorAll('.shop-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'buy'));
      renderShop();
      renderGold();
    },
    hide() { el.style.display = 'none'; if (_bg) _bg.stop(); },
  };
}

// ============================================================
// メイン描画（現在のタブに応じて分岐）
// ============================================================

/**
 * 現在のタブ（_tab）に対応した描画関数を呼ぶ
 */
function renderShop() {
  if (_tab === 'buy')           renderBuy();
  else if (_tab === 'sell')     renderSell();
  else if (_tab === 'identify') renderIdentify();
}

/**
 * 所持金の表示を更新する
 */
function renderGold() {
  const el = document.getElementById('shop-gold');
  if (el) el.textContent = Party.gold;
}

// ============================================================
// 購入タブ
// ============================================================

/**
 * 購入タブの商品リストを描画する
 * DB.weapons + DB.armors + DB.items を結合して全商品を表示
 */
function renderBuy() {
  const list = document.getElementById('shop-item-list');
  if (!list) return;
  list.innerHTML = '';

  // 3種類のDBを一つの配列にまとめる
  // Object.entries(obj) = { key: value } を [key, value] の配列に変換する組み込み関数
  const allItems = [
    ...Object.entries(DB.weapons).map(([k, v]) => ({ key: k, data: v, cat: 'weapon' })),
    ...Object.entries(DB.armors).map(([k, v])  => ({ key: k, data: v, cat: 'armor' })),
    ...Object.entries(DB.items).map(([k, v])   => ({ key: k, data: v, cat: 'item' })),
  ];

  allItems.forEach(({ key, data, cat }) => {
    const div = document.createElement('div');
    // 選択中の商品には 'selected' クラスを付ける（ハイライト表示）
    div.className = 'shop-item' + (_selectedKey === key ? ' selected' : '');
    div.innerHTML = `
      <span class="shop-item-name">${data.name}</span>
      <span class="shop-item-price">${data.value}G</span>
    `;
    div.addEventListener('click', () => {
      _selectedKey = key;
      renderBuy();                          // リストを再描画（選択状態更新）
      renderBuyDetail(key, data, cat);      // 詳細パネルを更新
    });
    list.appendChild(div);
  });

  if (_selectedKey) {
    // 選択済みならdetailパネルを維持
    const found = allItems.find(x => x.key === _selectedKey);
    if (found) renderBuyDetail(found.key, found.data, found.cat);
  } else {
    setDetailText('アイテムを選んでください');
    document.getElementById('shop-action-btns').innerHTML = '';
  }
}

/**
 * 購入タブの詳細パネルと購入ボタンを描画する
 * @param {string} key  - アイテムID
 * @param {object} data - アイテムデータ
 * @param {string} cat  - カテゴリ ('weapon'|'armor'|'item')
 */
function renderBuyDetail(key, data, cat) {
  const lines = buildItemDesc(data, cat); // テキスト説明を生成
  setDetailText(lines);

  const btns = document.getElementById('shop-action-btns');
  btns.innerHTML = '';

  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = `購入 (${data.value}G)`;
  btn.addEventListener('click', () => {
    if (Party.gold < data.value) {
      setDetailText(lines + '\n\n[所持金が足りません]');
      return;
    }
    Party.gold -= data.value;
    // パーティの最初の生存キャラに渡す
    const target = Party.members.find(isAlive);
    if (target) {
      target.items.push(key); // アイテムを所持品に追加（武器も items 配列に入れる）
      setDetailText(lines + `\n\n${target.name} が購入しました。`);
    } else {
      setDetailText(lines + '\n\n[パーティを編成してから購入してください]');
      Party.gold += data.value; // 返金
    }
    renderGold();
    document.getElementById('town-gold') && (document.getElementById('town-gold').textContent = `G: ${Party.gold}`);
  });
  btns.appendChild(btn);
}

// ============================================================
// 売却タブ
// ============================================================

/**
 * 売却タブを描画する
 * パーティメンバー全員の所持品を一覧に表示する
 * 売却価格は購入価格の50%（切り捨て）
 */
function renderSell() {
  const list = document.getElementById('shop-item-list');
  if (!list) return;
  list.innerHTML = '';

  // 全パーティメンバーの所持品を一つのリストにまとめる
  const sellItems = [];
  Party.members.forEach((c, ci) => {
    c.items.forEach((itemKey, ii) => {
      sellItems.push({ charIdx: ci, itemIdx: ii, key: itemKey });
    });
  });

  if (sellItems.length === 0) {
    list.innerHTML = '<div style="color:#504060;font-size:0.78rem;padding:10px;">売れるものがありません。</div>';
    setDetailText('売却できるアイテムがありません');
    document.getElementById('shop-action-btns').innerHTML = '';
    return;
  }

  sellItems.forEach(({ charIdx, itemIdx, key }, i) => {
    const data = DB.weapons[key] || DB.armors[key] || DB.items[key];
    if (!data) return;
    const char      = Party.members[charIdx];
    const sellPrice = Math.floor(data.value * 0.5); // 売却価格 = 購入価格の50%
    const selKey    = `${charIdx}_${itemIdx}`;       // 一意のキー文字列

    const div = document.createElement('div');
    div.className = 'shop-item' + (_selectedKey === selKey ? ' selected' : '');
    div.innerHTML = `
      <span class="shop-item-name">${data.name}
        <span class="shop-item-equipped">(${char.name})</span>
      </span>
      <span class="shop-item-price">${sellPrice}G</span>
    `;
    div.addEventListener('click', () => {
      _selectedKey = selKey;
      renderSell();
      renderSellDetail(charIdx, itemIdx, key, data, sellPrice);
    });
    list.appendChild(div);
  });

  if (!_selectedKey) {
    setDetailText('アイテムを選んでください');
    document.getElementById('shop-action-btns').innerHTML = '';
  }
}

/**
 * 売却タブの詳細パネルと売却ボタンを描画する
 */
function renderSellDetail(charIdx, itemIdx, key, data, sellPrice) {
  const cat   = DB.weapons[key] ? 'weapon' : DB.armors[key] ? 'armor' : 'item';
  const lines = buildItemDesc(data, cat) + `\n\n売却価格: ${sellPrice}G`;
  setDetailText(lines);

  const btns = document.getElementById('shop-action-btns');
  btns.innerHTML = '';
  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = `売却 (+${sellPrice}G)`;
  btn.addEventListener('click', () => {
    const char = Party.members[charIdx];
    if (!char) return;
    char.items.splice(itemIdx, 1); // インデックス位置から1個削除
    Party.gold += sellPrice;        // 売却金額を加算
    _selectedKey = null;
    renderGold();
    renderSell();
    setDetailText(`売却しました (+${sellPrice}G)`);
  });
  btns.appendChild(btn);
}

// ============================================================
// 鑑定タブ
// ============================================================

/**
 * 鑑定タブを描画する
 * 所持品の詳細情報を鑑定費100Gで確認できる
 */
function renderIdentify() {
  const list = document.getElementById('shop-item-list');
  if (!list) return;
  list.innerHTML = '';

  const IDENTIFY_COST = 100; // 鑑定費用（固定）

  // パーティの全所持品を一覧化
  const identifyItems = [];
  Party.members.forEach((c, ci) => {
    c.items.forEach((key, ii) => {
      const data = DB.weapons[key] || DB.armors[key] || DB.items[key];
      if (data) identifyItems.push({ charIdx: ci, itemIdx: ii, key, data });
    });
  });

  if (identifyItems.length === 0) {
    list.innerHTML = '<div style="color:#504060;font-size:0.78rem;padding:10px;">鑑定するものがありません。</div>';
    setDetailText('鑑定できるアイテムがありません');
    document.getElementById('shop-action-btns').innerHTML = '';
    return;
  }

  identifyItems.forEach(({ charIdx, itemIdx, key, data }, i) => {
    const char   = Party.members[charIdx];
    const selKey = `i_${charIdx}_${itemIdx}`; // 鑑定タブ用の一意キー（先頭に "i_" を付ける）
    const div    = document.createElement('div');
    div.className = 'shop-item' + (_selectedKey === selKey ? ' selected' : '');
    div.innerHTML = `
      <span class="shop-item-name">${data.name}
        <span class="shop-item-equipped">(${char.name})</span>
      </span>
      <span class="shop-item-price">${IDENTIFY_COST}G</span>
    `;
    div.addEventListener('click', () => {
      _selectedKey = selKey;
      renderIdentify();
      renderIdentifyDetail(key, data, IDENTIFY_COST);
    });
    list.appendChild(div);
  });

  if (!_selectedKey) {
    setDetailText(`鑑定費用: ${IDENTIFY_COST}Gです。\nアイテムを選んでください。`);
    document.getElementById('shop-action-btns').innerHTML = '';
  }
}

/**
 * 鑑定タブの詳細パネルと鑑定ボタンを描画する
 */
function renderIdentifyDetail(key, data, cost) {
  const cat   = DB.weapons[key] ? 'weapon' : DB.armors[key] ? 'armor' : 'item';
  const lines = buildItemDesc(data, cat);
  setDetailText(`鑑定費用: ${cost}G\n\n${lines}`);

  const btns = document.getElementById('shop-action-btns');
  btns.innerHTML = '';
  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = `鑑定する (${cost}G)`;
  btn.addEventListener('click', () => {
    if (Party.gold < cost) { setDetailText(lines + '\n\n[所持金が足りません]'); return; }
    Party.gold -= cost;
    renderGold();
    setDetailText(`【鑑定結果】\n\n${lines}\n\n鑑定完了！`);
  });
  btns.appendChild(btn);
}

// ============================================================
// ヘルパー
// ============================================================

/**
 * アイテムの説明テキストを生成する（詳細パネル用）
 * @param {object} data - アイテムデータ
 * @param {string} cat  - 'weapon' | 'armor' | 'item'
 * @returns {string}    - 複数行のテキスト
 */
function buildItemDesc(data, cat) {
  if (cat === 'weapon') {
    return [
      `${data.name}`,
      `種別: 武器`,
      `ダメージ: ${data.damage_dice}${data.damage_bonus ? (data.damage_bonus > 0 ? '+' : '') + data.damage_bonus : ''}`,
      `命中補正: ${data.hit_bonus || 0}`,
      `装備可: ${data.equip_jobs || '全職業'}`,
      ``,
      data.desc || '',
    ].join('\n');
  }
  if (cat === 'armor') {
    return [
      `${data.name}`,
      `種別: 防具`,
      `AC補正: ${data.ac_bonus}`,
      `装備可: ${data.equip_jobs || '全職業'}`,
      ``,
      data.desc || '',
    ].join('\n');
  }
  // アイテムカテゴリ
  return [
    `${data.name}`,
    `種別: アイテム`,
    `効果: ${data.effect || '-'}`,
    ``,
    data.desc || '',
  ].join('\n');
}

/**
 * 商品詳細パネルのテキストを更新する
 * @param {string} text - 表示するテキスト
 */
function setDetailText(text) {
  const el = document.getElementById('shop-detail-text');
  if (el) el.textContent = text;
}

export function initShopUI() {
  const el = document.getElementById('screen-shop');
  document.getElementById('btn-shop-back').addEventListener('click', () => showScreen('town'));

  // タブ切替
  document.querySelectorAll('.shop-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _tab = btn.dataset.tab;
      _selectedKey = null;
      _selectedCharIdx = -1;
      document.querySelectorAll('.shop-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderShop();
    });
  });

  return {
    show() {
      el.style.display = 'flex';
      _bg ??= initLocationBackground('shop');
      if (_bg) _bg.start();
      _tab = 'buy';
      _selectedKey = null;
      _selectedCharIdx = -1;
      document.querySelectorAll('.shop-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'buy'));
      renderShop();
      renderGold();
    },
    hide() { el.style.display = 'none'; if (_bg) _bg.stop(); },
  };
}

// ============================================================
// メイン描画
// ============================================================

function renderShop() {
  if (_tab === 'buy')      renderBuy();
  else if (_tab === 'sell')     renderSell();
  else if (_tab === 'identify') renderIdentify();
}

function renderGold() {
  const el = document.getElementById('shop-gold');
  if (el) el.textContent = Party.gold;
}

// ---- 購入タブ ----

function renderBuy() {
  const list = document.getElementById('shop-item-list');
  if (!list) return;
  list.innerHTML = '';

  // 武器・防具・アイテムを結合
  const allItems = [
    ...Object.entries(DB.weapons).map(([k, v]) => ({ key: k, data: v, cat: 'weapon' })),
    ...Object.entries(DB.armors).map(([k, v])  => ({ key: k, data: v, cat: 'armor' })),
    ...Object.entries(DB.items).map(([k, v])   => ({ key: k, data: v, cat: 'item' })),
  ];

  allItems.forEach(({ key, data, cat }) => {
    const div = document.createElement('div');
    div.className = 'shop-item' + (_selectedKey === key ? ' selected' : '');
    div.innerHTML = `
      <span class="shop-item-name">${data.name}</span>
      <span class="shop-item-price">${data.value}G</span>
    `;
    div.addEventListener('click', () => {
      _selectedKey = key;
      renderBuy();
      renderBuyDetail(key, data, cat);
    });
    list.appendChild(div);
  });

  if (_selectedKey) {
    // 選択済みならdetailを維持
    const found = allItems.find(x => x.key === _selectedKey);
    if (found) renderBuyDetail(found.key, found.data, found.cat);
  } else {
    setDetailText('アイテムを選んでください');
    document.getElementById('shop-action-btns').innerHTML = '';
  }
}

function renderBuyDetail(key, data, cat) {
  const lines = buildItemDesc(data, cat);
  setDetailText(lines);

  const btns = document.getElementById('shop-action-btns');
  btns.innerHTML = '';

  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = `購入 (${data.value}G)`;
  btn.addEventListener('click', () => {
    if (Party.gold < data.value) {
      setDetailText(lines + '\n\n[所持金が足りません]');
      return;
    }
    Party.gold -= data.value;
    // 誰かのアイテム欄に追加 — パーティ最初のキャラor全員に聞く
    const target = Party.members.find(isAlive);
    if (target) {
      if (cat === 'item') {
        target.items.push(key);
        setDetailText(lines + `\n\n${target.name} が購入しました。`);
      } else {
        target.items.push(key);   // 装備候補として持つ
        setDetailText(lines + `\n\n${target.name} の所持品に追加しました。`);
      }
    } else {
      setDetailText(lines + '\n\n[パーティを編成してから購入してください]');
      Party.gold += data.value; // 返金
    }
    renderGold();
    document.getElementById('town-gold') && (document.getElementById('town-gold').textContent = `G: ${Party.gold}`);
  });
  btns.appendChild(btn);
}

// ---- 売却タブ ----

function renderSell() {
  const list = document.getElementById('shop-item-list');
  if (!list) return;
  list.innerHTML = '';

  // 全パーティメンバーの所持品を一覧
  const sellItems = [];
  Party.members.forEach((c, ci) => {
    c.items.forEach((itemKey, ii) => {
      sellItems.push({ charIdx: ci, itemIdx: ii, key: itemKey });
    });
  });

  if (sellItems.length === 0) {
    list.innerHTML = '<div style="color:#504060;font-size:0.78rem;padding:10px;">売れるものがありません。</div>';
    setDetailText('売却できるアイテムがありません');
    document.getElementById('shop-action-btns').innerHTML = '';
    return;
  }

  sellItems.forEach(({ charIdx, itemIdx, key }, i) => {
    const data = DB.weapons[key] || DB.armors[key] || DB.items[key];
    if (!data) return;
    const char = Party.members[charIdx];
    const sellPrice = Math.floor(data.value * 0.5);
    const selKey = `${charIdx}_${itemIdx}`;

    const div = document.createElement('div');
    div.className = 'shop-item' + (_selectedKey === selKey ? ' selected' : '');
    div.innerHTML = `
      <span class="shop-item-name">${data.name}
        <span class="shop-item-equipped">(${char.name})</span>
      </span>
      <span class="shop-item-price">${sellPrice}G</span>
    `;
    div.addEventListener('click', () => {
      _selectedKey = selKey;
      renderSell();
      renderSellDetail(charIdx, itemIdx, key, data, sellPrice);
    });
    list.appendChild(div);
  });

  if (!_selectedKey) {
    setDetailText('アイテムを選んでください');
    document.getElementById('shop-action-btns').innerHTML = '';
  }
}

function renderSellDetail(charIdx, itemIdx, key, data, sellPrice) {
  const cat = DB.weapons[key] ? 'weapon' : DB.armors[key] ? 'armor' : 'item';
  const lines = buildItemDesc(data, cat) + `\n\n売却価格: ${sellPrice}G`;
  setDetailText(lines);

  const btns = document.getElementById('shop-action-btns');
  btns.innerHTML = '';
  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = `売却 (+${sellPrice}G)`;
  btn.addEventListener('click', () => {
    const char = Party.members[charIdx];
    if (!char) return;
    char.items.splice(itemIdx, 1);
    Party.gold += sellPrice;
    _selectedKey = null;
    renderGold();
    renderSell();
    setDetailText(`売却しました (+${sellPrice}G)`);
  });
  btns.appendChild(btn);
}

// ---- 鑑定タブ ----

function renderIdentify() {
  const list = document.getElementById('shop-item-list');
  if (!list) return;
  list.innerHTML = '';

  const IDENTIFY_COST = 100;

  // 未鑑定アイテム（今回は全アイテムを鑑定可能として実装）
  const identifyItems = [];
  Party.members.forEach((c, ci) => {
    c.items.forEach((key, ii) => {
      const data = DB.weapons[key] || DB.armors[key] || DB.items[key];
      if (data) identifyItems.push({ charIdx: ci, itemIdx: ii, key, data });
    });
  });

  if (identifyItems.length === 0) {
    list.innerHTML = '<div style="color:#504060;font-size:0.78rem;padding:10px;">鑑定するものがありません。</div>';
    setDetailText('鑑定できるアイテムがありません');
    document.getElementById('shop-action-btns').innerHTML = '';
    return;
  }

  identifyItems.forEach(({ charIdx, itemIdx, key, data }, i) => {
    const char = Party.members[charIdx];
    const selKey = `i_${charIdx}_${itemIdx}`;
    const div = document.createElement('div');
    div.className = 'shop-item' + (_selectedKey === selKey ? ' selected' : '');
    div.innerHTML = `
      <span class="shop-item-name">${data.name}
        <span class="shop-item-equipped">(${char.name})</span>
      </span>
      <span class="shop-item-price">${IDENTIFY_COST}G</span>
    `;
    div.addEventListener('click', () => {
      _selectedKey = selKey;
      renderIdentify();
      renderIdentifyDetail(key, data, IDENTIFY_COST);
    });
    list.appendChild(div);
  });

  if (!_selectedKey) {
    setDetailText(`鑑定費用: ${IDENTIFY_COST}Gです。\nアイテムを選んでください。`);
    document.getElementById('shop-action-btns').innerHTML = '';
  }
}

function renderIdentifyDetail(key, data, cost) {
  const cat = DB.weapons[key] ? 'weapon' : DB.armors[key] ? 'armor' : 'item';
  const lines = buildItemDesc(data, cat);
  setDetailText(`鑑定費用: ${cost}G\n\n${lines}`);

  const btns = document.getElementById('shop-action-btns');
  btns.innerHTML = '';
  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = `鑑定する (${cost}G)`;
  btn.addEventListener('click', () => {
    if (Party.gold < cost) { setDetailText(lines + '\n\n[所持金が足りません]'); return; }
    Party.gold -= cost;
    renderGold();
    setDetailText(`【鑑定結果】\n\n${lines}\n\n鑑定完了！`);
  });
  btns.appendChild(btn);
}

// ============================================================
// ヘルパー
// ============================================================

function buildItemDesc(data, cat) {
  if (cat === 'weapon') {
    return [
      `${data.name}`,
      `種別: 武器`,
      `ダメージ: ${data.damage_dice}${data.damage_bonus ? (data.damage_bonus > 0 ? '+' : '') + data.damage_bonus : ''}`,
      `命中補正: ${data.hit_bonus || 0}`,
      `装備可: ${data.equip_jobs || '全職業'}`,
      ``,
      data.desc || '',
    ].join('\n');
  }
  if (cat === 'armor') {
    return [
      `${data.name}`,
      `種別: 防具`,
      `AC補正: ${data.ac_bonus}`,
      `装備可: ${data.equip_jobs || '全職業'}`,
      ``,
      data.desc || '',
    ].join('\n');
  }
  // item
  return [
    `${data.name}`,
    `種別: アイテム`,
    `効果: ${data.effect || '-'}`,
    ``,
    data.desc || '',
  ].join('\n');
}

function setDetailText(text) {
  const el = document.getElementById('shop-detail-text');
  if (el) el.textContent = text;
}
