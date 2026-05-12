// js/ui/shopUI.js — 商店：購入・売却・鑑定
import { Party, DB, showScreen } from '../gameState.js';
import { isAlive } from '../character.js';
import { initLocationBackground } from './locationBackground.js';

let _bg  = null;
let _tab = 'buy';           // 'buy' | 'sell' | 'identify'
let _selectedKey = null;    // 選択中アイテム/武器/防具のキー
let _selectedCharIdx = -1;  // 売却/鑑定時の対象キャラ

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
