// js/dataLoader.js — txt ファイルを読み込みオブジェクトに変換

/**
 * コメント行(#)と空行を除いてパース
 */
function parseLines(text) {
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
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
