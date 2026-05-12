// js/battle.js — Wizardry風ターン制バトル

import { DB, Party, showScreen } from './gameState.js';
import { isActive, checkLevelUp } from './character.js';
import { rollDice } from './dataLoader.js';
import { renderBattle } from './ui/battleUI.js';

let _enemies = [];
let _log = [];
let _phase = 'command';   // command | resolving | result
let _cmdIndex = 0;        // 現在コマンド入力中のキャラインデックス
let _cmds = [];           // 各キャラのコマンド { type, target, spellId, itemId }
let _afterBattle = null;

/** 戦闘開始 */
export function startBattle(enemyIds, afterBattle) {
  _enemies = enemyIds.map(id => spawnEnemy(id));
  _log = [];
  _cmds = [];
  _cmdIndex = 0;
  _phase = 'command';
  _afterBattle = afterBattle;
  renderBattle({ enemies: _enemies, log: _log, phase: _phase, cmdIndex: _cmdIndex, cmds: _cmds });
  showScreen('battle');
}

function spawnEnemy(id) {
  const tmpl = DB.monsters[id];
  const hp = rollDice(tmpl.hp_dice);
  return { ...tmpl, hp, maxHp: hp, spawnId: Math.random() };
}

/** コマンド登録 (battleUI から呼ぶ) */
export function registerCommand(cmd) {
  _cmds[_cmdIndex] = cmd;
  // 次の生存キャラへ
  do { _cmdIndex++; } while (_cmdIndex < Party.members.length && !isActive(Party.members[_cmdIndex]));

  if (_cmdIndex >= Party.members.length) {
    _phase = 'resolving';
    resolveRound();
  } else {
    renderBattle({ enemies: _enemies, log: _log, phase: 'command', cmdIndex: _cmdIndex, cmds: _cmds });
  }
}

/** 1ラウンド処理 */
function resolveRound() {
  _log = [];

  // ターン順: agi 降順
  const actors = [];
  Party.members.forEach((c, i) => {
    if (isActive(c)) actors.push({ who: 'player', char: c, idx: i, agi: c.agi });
  });
  _enemies.forEach((e, i) => {
    if (e.hp > 0) actors.push({ who: 'enemy', enemy: e, idx: i, agi: e.level * 2 + Math.random() });
  });
  actors.sort((a, b) => b.agi - a.agi);

  for (const actor of actors) {
    if (actor.who === 'player') {
      const cmd = _cmds[actor.idx];
      if (!cmd) continue;
      execPlayerCmd(actor.char, cmd);
    } else {
      execEnemyAttack(actor.enemy);
    }
  }

  // 勝敗チェック
  const allEnemiesDead = _enemies.every(e => e.hp <= 0);
  const allPlayersDead = Party.members.every(c => !isActive(c));

  if (allEnemiesDead) {
    giveRewards();
    _phase = 'result';
    renderBattle({ enemies: _enemies, log: _log, phase: 'result', win: true, cmds: _cmds, cmdIndex: _cmdIndex });
    return;
  }
  if (allPlayersDead) {
    _phase = 'result';
    renderBattle({ enemies: _enemies, log: _log, phase: 'result', win: false, cmds: _cmds, cmdIndex: _cmdIndex });
    return;
  }

  // 次のラウンド
  _cmds = [];
  _cmdIndex = 0;
  while (_cmdIndex < Party.members.length && !isActive(Party.members[_cmdIndex])) _cmdIndex++;
  _phase = 'command';
  renderBattle({ enemies: _enemies, log: _log, phase: 'command', cmdIndex: _cmdIndex, cmds: _cmds });
}

function execPlayerCmd(char, cmd) {
  if (cmd.type === 'attack') {
    const enemy = _enemies[cmd.target];
    if (!enemy || enemy.hp <= 0) return;
    const job = DB.jobs[char.jobId];
    const hitRoll = rollDice('1d20') + job.hit_bonus;
    if (hitRoll > enemy.ac + 10) {
      const wpn = char.equip.weapon ? DB.weapons[char.equip.weapon] : null;
      const dmgDice = wpn ? wpn.dmg_dice : '1d4';
      const dmgBonus = wpn ? wpn.dmg_bonus : 0;
      const dmg = rollDice(dmgDice) + dmgBonus;
      enemy.hp -= dmg;
      addLog(`${char.name}の攻撃！ ${enemy.name}に${dmg}ダメージ。`);
      if (enemy.hp <= 0) addLog(`${enemy.name}は倒れた！`);
    } else {
      addLog(`${char.name}の攻撃は外れた！`);
    }
  } else if (cmd.type === 'spell') {
    castSpell(char, cmd);
  } else if (cmd.type === 'item') {
    useItem(char, cmd);
  } else if (cmd.type === 'flee') {
    const fleechance = 0.3 + Party.members.filter(isActive).length * 0.05;
    if (Math.random() < fleechance) {
      addLog('パーティは逃げ出した！');
      endBattle(false, true);
    } else {
      addLog('逃げられなかった！');
    }
  }
}

function castSpell(char, cmd) {
  const spell = DB.spells[cmd.spellId];
  if (!spell || char.mp < spell.mp_cost) {
    addLog(`${char.name}はMPが足りない！`);
    return;
  }
  char.mp -= spell.mp_cost;

  if (spell.school === 'mage') {
    if (spell.power.includes('d')) {
      // ダメージ呪文
      const targets = spell.target === 'all' ? _enemies.filter(e => e.hp > 0) : [_enemies[cmd.target]];
      for (const e of targets) {
        if (!e || e.hp <= 0) continue;
        // 魔法耐性チェック
        if (e.resist.includes('magic') || e.resist.includes('all')) {
          addLog(`${e.name}は魔法に耐えた！`);
          continue;
        }
        const dmg = rollDice(spell.power);
        e.hp -= dmg;
        addLog(`${spell.name}！ ${e.name}に${dmg}の魔法ダメージ。`);
        if (e.hp <= 0) addLog(`${e.name}は倒れた！`);
      }
    } else if (spell.power === 'sleep') {
      for (const e of _enemies.filter(e2 => e2.hp > 0)) {
        if (Math.random() < 0.6) {
          e._asleep = true;
          addLog(`${e.name}は眠りについた！`);
        }
      }
    }
  } else if (spell.school === 'priest') {
    if (spell.power.includes('hp:')) {
      const dice = spell.power.replace('hp:', '');
      const heal = rollDice(dice);
      const targets = spell.target === 'ally_all'
        ? Party.members.filter(isActive)
        : [Party.members[cmd.target]];
      for (const t of targets) {
        if (!t) continue;
        t.hp = Math.min(t.hp + heal, t.maxHp);
        addLog(`${spell.name}！ ${t.name}のHPが${heal}回復した。`);
      }
    } else if (spell.power === 'poison_cure') {
      const t = Party.members[cmd.target];
      if (t && t.status === 'poisoned') {
        t.status = 'ok';
        addLog(`${t.name}の毒が治った！`);
      }
    }
  }
}

function useItem(char, cmd) {
  const item = DB.items[cmd.itemId];
  if (!item) return;
  const idx = char.items.indexOf(cmd.itemId);
  if (idx === -1) { addLog('アイテムを持っていない。'); return; }
  char.items.splice(idx, 1);

  if (item.type === 'heal') {
    const hp = Number(item.effect.replace('hp:', ''));
    const t = Party.members[cmd.target] || char;
    t.hp = Math.min(t.hp + hp, t.maxHp);
    addLog(`${char.name}が${item.name}を使った！ ${t.name}のHPが${hp}回復。`);
  } else if (item.type === 'cure') {
    const t = Party.members[cmd.target] || char;
    t.status = 'ok';
    addLog(`${char.name}が${item.name}を使った！ ${t.name}の状態が回復。`);
  }
}

function execEnemyAttack(enemy) {
  if (enemy._asleep) {
    if (Math.random() < 0.3) { enemy._asleep = false; addLog(`${enemy.name}は目を覚ました！`); }
    return;
  }
  const targets = Party.members.filter(isActive);
  if (targets.length === 0) return;
  for (let i = 0; i < enemy.attacks; i++) {
    const t = targets[Math.floor(Math.random() * targets.length)];
    const hitRoll = rollDice('1d20') + enemy.level;
    if (hitRoll > t.ac + 10) {
      const dmg = rollDice(enemy.damage);
      t.hp -= dmg;
      addLog(`${enemy.name}の攻撃！ ${t.name}に${dmg}ダメージ。`);
      // 特殊効果
      if (enemy.special.includes('poison') && Math.random() < 0.3 && t.status === 'ok') {
        t.status = 'poisoned';
        addLog(`${t.name}は毒に侵された！`);
      }
      if (t.hp <= 0) {
        t.hp = 0;
        t.status = 'dead';
        addLog(`${t.name}は倒れた…`);
      }
    } else {
      addLog(`${enemy.name}の攻撃は${t.name}をかすりもしなかった。`);
    }
  }
}

function giveRewards() {
  let totalExp = 0, totalGold = 0;
  for (const e of _enemies) {
    totalExp += e.exp;
    totalGold += rollDice(`1d${e.gold + 1}`) - 1;
  }
  Party.gold += totalGold;
  const alive = Party.members.filter(isActive);
  const expEach = alive.length > 0 ? Math.floor(totalExp / alive.length) : 0;
  for (const c of alive) {
    c.exp += expEach;
    if (checkLevelUp(c)) {
      addLog(`${c.name}はレベル${c.level}に上がった！`);
    }
  }
  addLog(`戦闘終了。${totalExp}EXP と ${totalGold}G を獲得。`);
}

function endBattle(win, fled) {
  _phase = 'result';
  renderBattle({ enemies: _enemies, log: _log, phase: 'result', win, fled, cmds: _cmds, cmdIndex: _cmdIndex });
}

export function battleContinue() {
  if (_afterBattle) _afterBattle();
}

function addLog(msg) { _log.push(msg); }

export function getBattleState() {
  return { enemies: _enemies, log: _log, phase: _phase, cmdIndex: _cmdIndex, cmds: _cmds };
}
