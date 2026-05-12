// js/character.js — キャラクター生成・操作

import { DB } from './gameState.js';
import { rollDice } from './dataLoader.js';

let _nextId = 1;

/**
 * 新規キャラクターを生成する
 * @param {string} name
 * @param {string} jobId  jobs.txt の id
 * @returns {object} character
 */
export function createCharacter(name, jobId) {
  const job = DB.jobs[jobId];
  if (!job) throw new Error(`Unknown job: ${jobId}`);

  const maxHp = Math.max(1, rollDice(`1d${job.hp_die || 4}`) + job.vit);
  const maxMp = job.mp_die > 0 ? rollDice(`1d${job.mp_die}`) + job.int : 0;

  return {
    id: _nextId++,
    name,
    jobId,
    level: 1,
    exp: 0,
    expNext: 100,

    // base stats (初期値 = job定義値)
    str: job.str, int: job.int, pie: job.pie,
    vit: job.vit, agi: job.agi, luk: job.luk,

    // combat
    hp: maxHp, maxHp,
    mp: maxMp, maxMp,
    ac: job.ac,   // 低い方が強い (Wizardry式)

    // equipment slots
    equip: {
      weapon: null,
      armor: null,
      shield: null,
      helm: null,
    },

    // inventory (item id list)
    items: [],

    // status effects
    status: 'ok',   // ok | asleep | paralyzed | poisoned | stoned | dead | ashes
  };
}

/** AC計算 (装備を考慮) */
export function calcAC(char) {
  const job = DB.jobs[char.jobId];
  let ac = job.ac;
  for (const slot of Object.values(char.equip)) {
    if (!slot) continue;
    const armor = DB.armors[slot];
    if (armor) ac -= armor.ac_bonus;
  }
  return ac;
}

/** レベルアップ判定 */
export function checkLevelUp(char) {
  if (char.exp < char.expNext) return false;
  char.level++;
  char.expNext = Math.floor(char.expNext * 1.8);
  const job = DB.jobs[char.jobId];
  const hpGain = Math.max(1, rollDice(`1d${job.hp_die || 4}`));
  const mpGain = job.mp_die > 0 ? rollDice(`1d${job.mp_die}`) : 0;
  char.maxHp += hpGain;
  char.hp = Math.min(char.hp + hpGain, char.maxHp);
  char.maxMp += mpGain;
  char.mp = Math.min(char.mp + mpGain, char.maxMp);
  return true;
}

export function isAlive(char) {
  return char.status === 'ok' || char.status === 'poisoned' || char.status === 'asleep';
}
export function isActive(char) {
  return char.status === 'ok' || char.status === 'poisoned';
}
