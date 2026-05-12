// ============================================================
// js/character.js — キャラクター生成・ステータス計算
// ============================================================
// このファイルでは「キャラクター」に関する処理をまとめています。
//
// 主な役割：
//   1. 新しいキャラクターを作成する（createCharacter）
//   2. 防具を考慮した AC（アーマークラス）を計算する（calcAC）
//   3. 経験値からレベルアップを処理する（checkLevelUp）
//   4. キャラクターが生存しているか確認する（isAlive / isActive）
//
// Wizardry では AC が低いほど強い（マイナスがよい）というルールです。
// ============================================================

import { DB } from './gameState.js';
import { rollDice } from './dataLoader.js';

// キャラクターに振る一意な ID（毎回 1 ずつ増える）
let _nextId = 1;

/**
 * 新しいキャラクターオブジェクトを生成して返す
 *
 * @param {string} name  - キャラクター名（例: "アーサー"）
 * @param {string} jobId - 職業 ID（例: 'warrior', 'mage'）
 * @returns {object}     - キャラクターデータオブジェクト
 *
 * 処理の流れ：
 *   1. DB から職業データを取得する
 *   2. HP・MP をダイスロールで決める（ランダム性がある）
 *   3. 職業のベースステータスをそのままコピーする
 *   4. 装備・アイテム・状態などを初期化する
 */
export function createCharacter(name, jobId) {
  const job = DB.jobs[jobId];
  if (!job) throw new Error(`Unknown job: ${jobId}`);

  // HP = 1d(hp_die) + 体力ボーナス、最低でも1
  // 例: 戦士なら hp_die=8 なので 1d8 + vit の値が初期 HP
  const maxHp = Math.max(1, rollDice(`1d${job.hp_die || 4}`) + job.vit);

  // MP = mp_die が 0 より大きい職業（魔法使い系）だけ持つ
  // 戦士など魔法を使えない職業は 0 になる
  const maxMp = job.mp_die > 0 ? rollDice(`1d${job.mp_die}`) + job.int : 0;

  return {
    id: _nextId++,     // ユニーク ID（1, 2, 3... と自動採番）
    name,              // キャラクター名
    jobId,             // 職業 ID（"warrior" など）
    level: 1,          // 初期レベル 1
    exp: 0,            // 現在の経験値
    expNext: 100,      // 次のレベルに必要な経験値

    // --- 基礎ステータス（職業定義値をそのまま使う） ---
    str: job.str,  // 力（物理攻撃力に影響）
    int: job.int,  // 知性（魔法の威力・MP に影響）
    pie: job.pie,  // 信仰心（回復魔法の効果に影響）
    vit: job.vit,  // 体力（HP 増加量に影響）
    agi: job.agi,  // 素早さ（行動順・回避に影響）
    luk: job.luk,  // 運（宝箱・クリティカルに影響）

    // --- 戦闘ステータス ---
    hp: maxHp, maxHp,    // 現在HP と最大HP（初期は同じ値）
    mp: maxMp, maxMp,    // 現在MP と最大MP
    ac: job.ac,          // アーマークラス（低いほど防御が高い）

    // --- 装備スロット ---
    // null = 何も装備していない状態
    equip: {
      weapon: null,  // 武器スロット
      armor:  null,  // 鎧スロット
      shield: null,  // 盾スロット
      helm:   null,  // 兜スロット
    },

    // --- 所持アイテム ---
    // アイテム ID の配列（同じアイテムは ID を複数入れる）
    // 例: ['potion_hp_s', 'potion_hp_s'] = 小ポーション 2個
    items: [],

    // --- 状態異常 ---
    // ok = 正常, asleep = 眠り, paralyzed = 麻痺,
    // poisoned = 毒, stoned = 石化, dead = 死亡, ashes = 灰
    status: 'ok',
  };
}

/**
 * 装備を考慮した実際の AC を計算する
 *
 * @param {object} char - キャラクターオブジェクト
 * @returns {number}    - 計算後の AC 値
 *
 * ロジック：
 *   職業の基本 AC から、装備している防具の AC ボーナスを引く
 *   （引くと数値が下がり＝より強くなる）
 */
export function calcAC(char) {
  const job = DB.jobs[char.jobId];
  let ac = job.ac; // まず職業の基本 AC からスタート

  // 全装備スロットをループして防具ボーナスを合計する
  for (const slot of Object.values(char.equip)) {
    if (!slot) continue; // null（未装備）はスキップ
    const armor = DB.armors[slot];
    if (armor) ac -= armor.ac_bonus; // ボーナス分だけ AC を下げる
  }
  return ac;
}

/**
 * キャラクターのレベルアップ判定と処理を行う
 *
 * @param {object} char - キャラクターオブジェクト
 * @returns {boolean}   - レベルアップしたなら true
 *
 * ロジック：
 *   1. 経験値が次のレベルに必要な値に達していなければ false を返す
 *   2. 達していればレベルを上げ、HP・MP をダイスロールで増やす
 *   3. 次のレベルまでの必要経験値を 1.8 倍に増やす（上がるほど大変になる）
 */
export function checkLevelUp(char) {
  if (char.exp < char.expNext) return false; // まだレベルアップ条件を満たしていない

  char.level++;
  // 次レベルの必要 EXP を 1.8 倍に更新（小数は切り捨て）
  char.expNext = Math.floor(char.expNext * 1.8);

  const job = DB.jobs[char.jobId];
  // HP と MP をダイスロールで増やす（最低 1 HP は保証）
  const hpGain = Math.max(1, rollDice(`1d${job.hp_die || 4}`));
  const mpGain = job.mp_die > 0 ? rollDice(`1d${job.mp_die}`) : 0;

  char.maxHp += hpGain;
  // 現在 HP も増加分を加算（ただし最大 HP を超えないようにする）
  char.hp = Math.min(char.hp + hpGain, char.maxHp);

  char.maxMp += mpGain;
  char.mp = Math.min(char.mp + mpGain, char.maxMp);

  return true;
}

/**
 * キャラクターが「生きている」状態かを確認する
 * 毒・眠りでも生存扱い（戦闘に参加はできないが回復可能）
 *
 * @param {object} char
 * @returns {boolean}
 */
export function isAlive(char) {
  return char.status === 'ok' || char.status === 'poisoned' || char.status === 'asleep';
}

/**
 * キャラクターが「行動できる」状態かを確認する
 * 毒はかかっていても行動できるが、眠り・麻痺などは行動不能
 *
 * @param {object} char
 * @returns {boolean}
 */
export function isActive(char) {
  return char.status === 'ok' || char.status === 'poisoned';
}
