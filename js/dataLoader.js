// ============================================================
// js/dataLoader.js — テキストファイルの読み込みとパース
// ============================================================
// このファイルの役割：
//   public/data/ フォルダにある .txt ファイルを読み込み、
//   JavaScript で扱いやすいオブジェクト形式に変換します。
//
// テキストファイルの形式：
//   # で始まる行はコメント（無視する）
//   空行も無視する
//   各データは | （パイプ）で区切られたフィールドで構成
//   例: warrior|戦士|10|0|12|6|6|12|8|8|2|-8|warrior,samurai|剣と盾を...
//
// fetch API：
//   ブラウザからファイルを取得する仕組み。
//   async/await と組み合わせて「ファイルが届いてから次の処理へ」進みます。
// ============================================================

/**
 * テキストをパース（解析）する前処理
 * コメント行（# で始まる）と空行を取り除いて配列にする
 *
 * @param {string} text - .txt ファイルの生テキスト
 * @returns {string[]}  - 有効な行だけの配列
 *
 * 例: "# コメント\n\nwarrior|戦士|..." → ["warrior|戦士|..."]
 */
function parseLines(text) {
  return text.split('\n')            // 改行で分割して行の配列にする
    .map(l => l.trim())              // 各行の前後の空白を取り除く
    .filter(l => l && !l.startsWith('#')); // 空行と # コメント行を除外する
}

// ============================================================
// 各データファイルの読み込み関数
// ============================================================
// どの関数も同じパターン：
//   1. fetch でファイルを取得する
//   2. テキストとしてパースする
//   3. 各行を | で分割してオブジェクトに変換する
//   4. id をキーにした連想配列（辞書）として返す
// ============================================================

/**
 * 職業データ (jobs.txt) を読み込む
 * 各行フォーマット: id|名前|HP骰子|MP骰子|STR|INT|PIE|VIT|AGI|LUK|命中|AC|装備可|説明
 */
export async function loadJobs() {
  const res = await fetch('./data/jobs.txt');   // ファイルを取得
  const text = await res.text();               // テキストとして読む
  const jobs = {};
  for (const line of parseLines(text)) {
    // | で分割して各フィールドに名前をつける
    const [id, name, hp_die, mp_die, str, int_, pie, vit, agi, luk, hit, ac, equip, desc] = line.split('|');
    jobs[id] = {
      id, name,
      hp_die: Number(hp_die),    // HP ダイス面数（例: 10 → d10）
      mp_die: Number(mp_die),    // MP ダイス面数（0 なら MP なし）
      str: Number(str),          // 力
      int: Number(int_),         // 知性（int は JS の予約語なので int_ にしている）
      pie: Number(pie),          // 信仰心
      vit: Number(vit),          // 体力
      agi: Number(agi),          // 素早さ
      luk: Number(luk),          // 運
      hit_bonus: Number(hit),    // 命中ボーナス
      ac: Number(ac),            // 基本アーマークラス
      can_equip: equip.split(','), // 装備できるカテゴリ（カンマ区切りを配列に）
      desc,                      // 職業説明テキスト
    };
  }
  return jobs;
}

/**
 * 武器データ (weapons.txt) を読み込む
 * 各行フォーマット: id|名前|種別|ダメージ骰子|ダメージ補正|命中補正|価値|装備可職業|説明
 */
export async function loadWeapons() {
  const res = await fetch('./data/weapons.txt');
  const text = await res.text();
  const weapons = {};
  for (const line of parseLines(text)) {
    const [id, name, type, dmg_dice, dmg_bonus, hit_bonus, value, jobs, desc] = line.split('|');
    weapons[id] = {
      id, name, type,
      dmg_dice,                       // ダメージダイス（例: "1d8"）
      dmg_bonus: Number(dmg_bonus),   // ダメージ固定ボーナス
      hit_bonus: Number(hit_bonus),   // 命中補正
      value: Number(value),           // 売買価格（ゴールド）
      equip_jobs: jobs.split(','),    // 装備できる職業リスト
      desc,
      category: 'weapon',             // 種別識別用フラグ
    };
  }
  return weapons;
}

/**
 * 防具データ (armors.txt) を読み込む
 * 各行フォーマット: id|名前|種別|AC補正|価値|装備可職業|説明
 */
export async function loadArmors() {
  const res = await fetch('./data/armors.txt');
  const text = await res.text();
  const armors = {};
  for (const line of parseLines(text)) {
    const [id, name, type, ac_bonus, value, jobs, desc] = line.split('|');
    armors[id] = {
      id, name, type,
      ac_bonus: Number(ac_bonus),   // AC 改善値（大きいほど防御が高い）
      value: Number(value),
      equip_jobs: jobs.split(','),
      desc,
      category: 'armor',
    };
  }
  return armors;
}

/**
 * アイテムデータ (items.txt) を読み込む
 * 各行フォーマット: id|名前|種別|効果|価値|説明
 */
export async function loadItems() {
  const res = await fetch('./data/items.txt');
  const text = await res.text();
  const items = {};
  for (const line of parseLines(text)) {
    const [id, name, type, effect, value, desc] = line.split('|');
    // type: 'heal'（HP回復）, 'cure'（状態異常回復）など
    // effect: 'hp:30' → HP を 30 回復するという意味
    items[id] = { id, name, type, effect, value: Number(value), desc, category: 'item' };
  }
  return items;
}

/**
 * 呪文データ (spells.txt) を読み込む
 * 各行フォーマット: id|名前|系統|レベル|対象|威力|MPコスト|使用可職業|説明
 */
export async function loadSpells() {
  const res = await fetch('./data/spells.txt');
  const text = await res.text();
  const spells = {};
  for (const line of parseLines(text)) {
    const [id, name, school, level, target, power, mp_cost, jobs, desc] = line.split('|');
    spells[id] = {
      id, name,
      school,                     // 'mage'（魔法使い系）or 'priest'（神官系）
      level: Number(level),       // 習得できるレベル
      target,                     // 'single'（単体）, 'all'（全体）, 'ally'（味方）
      power,                      // 威力（例: "2d8" や "hp:20"）
      mp_cost: Number(mp_cost),   // 消費 MP
      jobs: jobs.split(','),      // 使用できる職業
      desc,
    };
  }
  return spells;
}

/**
 * モンスターデータ (monsters.txt) を読み込む
 * 各行フォーマット: id|名前|HP骰子|AC|攻撃回数|ダメージ|EXP|Gold|レベル|耐性|特殊|説明
 */
export async function loadMonsters() {
  const res = await fetch('./data/monsters.txt');
  const text = await res.text();
  const monsters = {};
  for (const line of parseLines(text)) {
    const [id, name, hp_dice, ac, attacks, damage, exp, gold, level, resist, special, desc] = line.split('|');
    monsters[id] = {
      id, name,
      hp_dice,                      // HP ダイス（例: "2d8" → 2〜16 HP）
      ac: Number(ac),
      attacks: Number(attacks),     // 1回の行動での攻撃回数
      damage,                       // 1回の攻撃ダメージ（例: "1d6"）
      exp: Number(exp),             // 倒したときの経験値
      gold: Number(gold),           // 倒したときのゴールド（上限値として使用）
      level: Number(level),         // モンスターレベル（命中・素早さに影響）
      resist: resist.split(','),    // 耐性リスト（例: ['magic', 'fire']）
      special: special.split(','),  // 特殊能力（例: ['poison']）
      desc,
    };
  }
  return monsters;
}

/**
 * マップデータ (maps.txt) を読み込む
 * フロアごとに 2D 配列（行列）として返す
 *
 * ファイル形式：
 *   ---FLOOR:1---     ← フロア区切りマーカー
 *   11111             ← 各文字が 1 マス
 *   1S001             ← S=スタート, E=降り階段, U=上り階段, 0=通路, 1=壁
 *   11E11
 *
 * 戻り値の例:
 *   { 1: [['1','1','1'], ['1','S','0'], ...], 2: [...] }
 */
export async function loadMaps() {
  const res = await fetch('./data/maps.txt');
  const text = await res.text();
  const floors = {};      // フロア番号 → 2D配列
  let currentFloor = null; // 今処理中のフロア番号
  let grid = [];           // 現在のフロアの行データ

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue; // 空行・コメントはスキップ

    // フロア区切りの行か確認（例: "---FLOOR:1---"）
    const floorMatch = line.match(/^---FLOOR:(\d+)---$/);
    if (floorMatch) {
      // 前のフロアのデータを保存してから次のフロアを開始
      if (currentFloor !== null) floors[currentFloor] = grid;
      currentFloor = Number(floorMatch[1]); // フロア番号を取り出す
      grid = []; // グリッドをリセット
    } else if (currentFloor !== null) {
      // 通常のマップ行：1文字ずつに分割して行配列に追加
      // 例: "11S01" → ['1','1','S','0','1']
      grid.push(line.split(''));
    }
  }
  // 最後のフロアを忘れずに保存
  if (currentFloor !== null) floors[currentFloor] = grid;
  return floors;
}

/**
 * ダイス記法（"NdM" 形式）でサイコロを振り、結果を返す
 *
 * @param {string|number} notation - 例: "2d6", "1d8+2", "3d4-1", または数値
 * @returns {number} - サイコロの合計値
 *
 * 使い方の例：
 *   rollDice('1d6')    → 1〜6 のランダムな整数
 *   rollDice('2d8')    → 2〜16 のランダムな整数（8面体を2回振る）
 *   rollDice('1d6+3')  → 4〜9（ボーナス +3）
 *   rollDice(5)        → 5（数値をそのまま返す）
 *
 * 仕組み：
 *   正規表現で "N"（回数）・"d"・"M"（面数）・"±bonus" を抽出して計算
 */
export function rollDice(notation) {
  // 正規表現で "2d8+3" のような表記を分解する
  // m[1]=回数(N), m[2]=面数(M), m[3]=ボーナス(±数値 または undefined)
  const m = String(notation).match(/^(\d+)d(\d+)([+-]\d+)?$/i);

  // マッチしなかったら数値として解釈（数値でもなければ 0）
  if (!m) return Number(notation) || 0;

  const n     = parseInt(m[1]);           // ダイスを振る回数
  const d     = parseInt(m[2]);           // ダイスの面数
  const bonus = parseInt(m[3] || 0);      // ボーナス値（なければ 0）

  let total = bonus;
  // n 回ダイスを振って合計する
  // Math.random() → 0以上1未満のランダムな小数
  // * d + 1 → 1以上d以下の整数に変換
  for (let i = 0; i < n; i++) total += Math.floor(Math.random() * d) + 1;

  return Math.max(0, total); // 0 を下限にして返す（マイナスにならない）
}

export async function loadJobs() {
  const res = await fetch('./data/jobs.txt');
  const text = await res.text();
  const jobs = {};
  for (const line of parseLines(text)) {
    const [id, name, hp_die, mp_die, str, int_, pie, vit, agi, luk, hit, ac, equip, desc] = line.split('|');
    jobs[id] = {
      id, name,
      hp_die: Number(hp_die), mp_die: Number(mp_die),
      str: Number(str), int: Number(int_), pie: Number(pie),
      vit: Number(vit), agi: Number(agi), luk: Number(luk),
      hit_bonus: Number(hit), ac: Number(ac),
      can_equip: equip.split(','),
      desc,
    };
  }
  return jobs;
}

export async function loadWeapons() {
  const res = await fetch('./data/weapons.txt');
  const text = await res.text();
  const weapons = {};
  for (const line of parseLines(text)) {
    const [id, name, type, dmg_dice, dmg_bonus, hit_bonus, value, jobs, desc] = line.split('|');
    weapons[id] = {
      id, name, type,
      dmg_dice,
      dmg_bonus: Number(dmg_bonus),
      hit_bonus: Number(hit_bonus),
      value: Number(value),
      equip_jobs: jobs.split(','),
      desc,
      category: 'weapon',
    };
  }
  return weapons;
}

export async function loadArmors() {
  const res = await fetch('./data/armors.txt');
  const text = await res.text();
  const armors = {};
  for (const line of parseLines(text)) {
    const [id, name, type, ac_bonus, value, jobs, desc] = line.split('|');
    armors[id] = {
      id, name, type,
      ac_bonus: Number(ac_bonus),
      value: Number(value),
      equip_jobs: jobs.split(','),
      desc,
      category: 'armor',
    };
  }
  return armors;
}

export async function loadItems() {
  const res = await fetch('./data/items.txt');
  const text = await res.text();
  const items = {};
  for (const line of parseLines(text)) {
    const [id, name, type, effect, value, desc] = line.split('|');
    items[id] = { id, name, type, effect, value: Number(value), desc, category: 'item' };
  }
  return items;
}

export async function loadSpells() {
  const res = await fetch('./data/spells.txt');
  const text = await res.text();
  const spells = {};
  for (const line of parseLines(text)) {
    const [id, name, school, level, target, power, mp_cost, jobs, desc] = line.split('|');
    spells[id] = {
      id, name, school,
      level: Number(level),
      target, power,
      mp_cost: Number(mp_cost),
      jobs: jobs.split(','),
      desc,
    };
  }
  return spells;
}

export async function loadMonsters() {
  const res = await fetch('./data/monsters.txt');
  const text = await res.text();
  const monsters = {};
  for (const line of parseLines(text)) {
    const [id, name, hp_dice, ac, attacks, damage, exp, gold, level, resist, special, desc] = line.split('|');
    monsters[id] = {
      id, name, hp_dice, ac: Number(ac),
      attacks: Number(attacks), damage,
      exp: Number(exp), gold: Number(gold),
      level: Number(level),
      resist: resist.split(','),
      special: special.split(','),
      desc,
    };
  }
  return monsters;
}

/**
 * maps.txt を読み込み、フロアごとに 2D 配列を返す
 * tile: 0=床, 1=壁, S=スタート, E=降り階段, U=上り階段
 */
export async function loadMaps() {
  const res = await fetch('./data/maps.txt');
  const text = await res.text();
  const floors = {};
  let currentFloor = null;
  let grid = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const floorMatch = line.match(/^---FLOOR:(\d+)---$/);
    if (floorMatch) {
      if (currentFloor !== null) floors[currentFloor] = grid;
      currentFloor = Number(floorMatch[1]);
      grid = [];
    } else if (currentFloor !== null) {
      grid.push(line.split(''));
    }
  }
  if (currentFloor !== null) floors[currentFloor] = grid;
  return floors;
}

/** ダイス記法 "NdM" をロール */
export function rollDice(notation) {
  const m = String(notation).match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!m) return Number(notation) || 0;
  const n = parseInt(m[1]), d = parseInt(m[2]), bonus = parseInt(m[3] || 0);
  let total = bonus;
  for (let i = 0; i < n; i++) total += Math.floor(Math.random() * d) + 1;
  return Math.max(0, total);
}
