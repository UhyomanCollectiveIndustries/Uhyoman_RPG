// ============================================================
// js/battle.js — Wizardry風ターン制バトルのロジック
// ============================================================
// このファイルの役割：
//   バトルの全ての「ゲームロジック」（ルール・計算）を担当します。
//   画面への表示は battleUI.js に任せ、こちらは純粋に計算だけ行います。
//
// バトルの流れ：
//   1. startBattle() で戦闘開始、モンスターを出現させる
//   2. コマンドフェーズ：各キャラのコマンドを順番に受け付ける
//   3. 解決フェーズ：素早さ順に行動を処理する
//   4. 勝敗判定：全モンスターが倒れたら勝利、全員が行動不能なら敗北
//
// 「ターン制」= 全員がコマンドを入力してから、まとめて行動する方式
//              （Wizardry の伝統的な戦闘システム）
// ============================================================

import { DB, Party, showScreen } from './gameState.js';
import { isActive, checkLevelUp } from './character.js';
import { rollDice } from './dataLoader.js';
import { renderBattle } from './ui/battleUI.js';

// --- モジュール内の状態変数 ---
// これらはこのファイルの中だけで使われる「バトル中の状態」です
let _enemies    = [];     // 現在戦っている敵の配列（spawnEnemy で生成）
let _log        = [];     // バトルログ（「○○の攻撃！△△に5ダメージ」などのメッセージ）
let _phase      = 'command'; // バトルのフェーズ: 'command'=入力中 / 'resolving'=処理中 / 'result'=結果
let _cmdIndex   = 0;      // 現在コマンドを入力してもらうキャラのインデックス（0から開始）
let _cmds       = [];     // 各キャラのコマンド { type, target, spellId, itemId }
let _afterBattle = null;  // バトル終了後に呼ぶコールバック関数（ダンジョンに戻るなど）

// ============================================================
// 外部から呼ばれる公開関数
// ============================================================

/**
 * 戦闘を開始する
 *
 * @param {string[]} enemyIds  - 出現するモンスターの ID 配列（例: ['kobold', 'kobold']）
 * @param {Function} afterBattle - 戦闘後に実行するコールバック（例: ダンジョンに戻る処理）
 *
 * 処理の流れ：
 *   1. 敵キャラクターを生成してステータスを初期化
 *   2. ログ・コマンドをリセット
 *   3. バトル画面を描画して表示
 */
export function startBattle(enemyIds, afterBattle) {
  // enemyIds を spawnEnemy でモンスターオブジェクトに変換
  _enemies = enemyIds.map(id => spawnEnemy(id));
  _log        = [];
  _cmds       = [];
  _cmdIndex   = 0;
  _phase      = 'command';
  _afterBattle = afterBattle;

  // 初期状態を描画して battle 画面に切り替える
  renderBattle({ enemies: _enemies, log: _log, phase: _phase, cmdIndex: _cmdIndex, cmds: _cmds });
  showScreen('battle');
}

/**
 * モンスターのテンプレートから戦闘用インスタンスを生成する
 * テンプレート（DB.monsters）= 設計図、インスタンス = 実際に戦う1体
 *
 * @param {string} id - モンスター ID（例: 'kobold'）
 * @returns {object}  - HP など実際の値を持つモンスターオブジェクト
 */
function spawnEnemy(id) {
  const tmpl = DB.monsters[id];           // DB からテンプレートを取得
  const hp   = rollDice(tmpl.hp_dice);    // HP をダイスロールで決める
  // スプレッド構文（...tmpl）でテンプレートの全プロパティをコピーし、HP を上書き
  return { ...tmpl, hp, maxHp: hp, spawnId: Math.random() };
}

/**
 * プレイヤーのコマンドを登録する（battleUI.js から呼ばれる）
 *
 * @param {object} cmd - コマンドオブジェクト
 *   { type: 'attack', target: 0 }     → 0番の敵を攻撃
 *   { type: 'spell', spellId: 'fire', target: 1 } → 呪文使用
 *   { type: 'item', itemId: 'potion_hp_s', target: 0 } → アイテム使用
 *   { type: 'flee' }                  → 逃げる
 *
 * 処理の流れ：
 *   1. _cmds に今のキャラのコマンドを保存
 *   2. 次の行動可能キャラへ移動（死亡・麻痺キャラはスキップ）
 *   3. 全員分揃ったら resolveRound() で一括処理
 */
export function registerCommand(cmd) {
  _cmds[_cmdIndex] = cmd; // 現在キャラのコマンドを記録

  // 次の行動可能なキャラへインデックスを進める
  // do...while = 最低1回実行してから条件チェック
  do { _cmdIndex++; } while (
    _cmdIndex < Party.members.length &&
    !isActive(Party.members[_cmdIndex]) // 行動不能キャラは飛ばす
  );

  if (_cmdIndex >= Party.members.length) {
    // 全員のコマンドが揃ったのでラウンド処理へ
    _phase = 'resolving';
    resolveRound();
  } else {
    // まだ入力待ちのキャラがいる → コマンドパネルを次のキャラで更新
    renderBattle({ enemies: _enemies, log: _log, phase: 'command', cmdIndex: _cmdIndex, cmds: _cmds });
  }
}

// ============================================================
// バトル内部処理
// ============================================================

/**
 * 1ラウンドの全行動を処理する
 *
 * 処理の流れ：
 *   1. プレイヤー全員と敵全員を「アクターリスト」にまとめる
 *   2. 素早さ（agi）の高い順にソートする
 *   3. 順番に行動させる（プレイヤーはコマンド実行、敵はAI攻撃）
 *   4. 全敵が倒れたら勝利、全プレイヤーが倒れたら敗北を判定
 */
function resolveRound() {
  _log = []; // ラウンド開始時にログをリセット

  // --- アクターリストを作成 ---
  // プレイヤーキャラクターを追加（行動できる者のみ）
  const actors = [];
  Party.members.forEach((c, i) => {
    if (isActive(c)) actors.push({ who: 'player', char: c, idx: i, agi: c.agi });
  });
  // 敵を追加（HP が残っている者のみ）
  // 敵の素早さはレベル * 2 + 乱数（少し不規則にする）
  _enemies.forEach((e, i) => {
    if (e.hp > 0) actors.push({ who: 'enemy', enemy: e, idx: i, agi: e.level * 2 + Math.random() });
  });

  // 素早さ降順（高い方が先に行動）でソート
  actors.sort((a, b) => b.agi - a.agi);

  // --- 行動処理 ---
  for (const actor of actors) {
    if (actor.who === 'player') {
      const cmd = _cmds[actor.idx];
      if (!cmd) continue;
      execPlayerCmd(actor.char, cmd); // プレイヤーのコマンドを実行
    } else {
      execEnemyAttack(actor.enemy);   // 敵のAI攻撃を実行
    }
  }

  // --- 勝敗チェック ---
  const allEnemiesDead  = _enemies.every(e => e.hp <= 0);
  const allPlayersDead  = Party.members.every(c => !isActive(c));

  if (allEnemiesDead) {
    giveRewards(); // 経験値・ゴールド配布
    _phase = 'result';
    renderBattle({ enemies: _enemies, log: _log, phase: 'result', win: true, cmds: _cmds, cmdIndex: _cmdIndex });
    return;
  }
  if (allPlayersDead) {
    _phase = 'result';
    renderBattle({ enemies: _enemies, log: _log, phase: 'result', win: false, cmds: _cmds, cmdIndex: _cmdIndex });
    return;
  }

  // --- 次のラウンドへ ---
  _cmds     = [];
  _cmdIndex = 0;
  // 最初の行動可能キャラを探す
  while (_cmdIndex < Party.members.length && !isActive(Party.members[_cmdIndex])) _cmdIndex++;
  _phase = 'command';
  renderBattle({ enemies: _enemies, log: _log, phase: 'command', cmdIndex: _cmdIndex, cmds: _cmds });
}

/**
 * プレイヤーキャラクターのコマンドを実行する
 *
 * @param {object} char - 行動するキャラクター
 * @param {object} cmd  - コマンドオブジェクト
 */
function execPlayerCmd(char, cmd) {
  if (cmd.type === 'attack') {
    // ─── 通常攻撃 ───
    const enemy = _enemies[cmd.target];
    if (!enemy || enemy.hp <= 0) return; // 対象が既に倒れていたらスキップ

    const job     = DB.jobs[char.jobId];
    // 命中判定：1d20 + 命中ボーナス が 敵AC + 10 を超えれば命中
    // （Wizardry では低い AC が強いので + 10 で調整している）
    const hitRoll = rollDice('1d20') + job.hit_bonus;
    if (hitRoll > enemy.ac + 10) {
      // 命中した → ダメージ計算
      const wpn      = char.equip.weapon ? DB.weapons[char.equip.weapon] : null;
      const dmgDice  = wpn ? wpn.dmg_dice  : '1d4'; // 素手は 1d4
      const dmgBonus = wpn ? wpn.dmg_bonus : 0;
      const dmg      = rollDice(dmgDice) + dmgBonus;
      enemy.hp -= dmg;
      addLog(`${char.name}の攻撃！ ${enemy.name}に${dmg}ダメージ。`);
      if (enemy.hp <= 0) addLog(`${enemy.name}は倒れた！`);
    } else {
      addLog(`${char.name}の攻撃は外れた！`);
    }

  } else if (cmd.type === 'spell') {
    castSpell(char, cmd); // 呪文処理は別関数

  } else if (cmd.type === 'item') {
    useItem(char, cmd);   // アイテム使用は別関数

  } else if (cmd.type === 'flee') {
    // ─── 逃走 ───
    // 逃走成功率 = 30% + 生存メンバー数 × 5%（多いほど逃げやすい）
    const fleechance = 0.3 + Party.members.filter(isActive).length * 0.05;
    if (Math.random() < fleechance) {
      addLog('パーティは逃げ出した！');
      endBattle(false, true); // 敗北扱い（fled=true）
    } else {
      addLog('逃げられなかった！');
    }
  }
}

/**
 * 呪文を詠唱する
 *
 * @param {object} char - 詠唱するキャラクター
 * @param {object} cmd  - { type:'spell', spellId, target }
 */
function castSpell(char, cmd) {
  const spell = DB.spells[cmd.spellId];
  if (!spell || char.mp < spell.mp_cost) {
    addLog(`${char.name}はMPが足りない！`);
    return;
  }
  char.mp -= spell.mp_cost; // MP を消費

  if (spell.school === 'mage') {
    // ─── 魔法使い系呪文 ───
    if (spell.power.includes('d')) {
      // ダメージ呪文（例: power = "3d8"）
      // target が 'all' なら全生存敵が対象、それ以外は単体
      const targets = spell.target === 'all'
        ? _enemies.filter(e => e.hp > 0)
        : [_enemies[cmd.target]];
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
      // 睡眠呪文：60% の確率で各敵を眠らせる
      for (const e of _enemies.filter(e2 => e2.hp > 0)) {
        if (Math.random() < 0.6) {
          e._asleep = true;
          addLog(`${e.name}は眠りについた！`);
        }
      }
    }
  } else if (spell.school === 'priest') {
    // ─── 神官系呪文 ───
    if (spell.power.includes('hp:')) {
      // 回復呪文（例: power = "hp:2d6"）
      const dice = spell.power.replace('hp:', '');
      const heal = rollDice(dice);
      const targets = spell.target === 'ally_all'
        ? Party.members.filter(isActive) // 全生存メンバー
        : [Party.members[cmd.target]];   // 単体
      for (const t of targets) {
        if (!t) continue;
        t.hp = Math.min(t.hp + heal, t.maxHp); // maxHp を超えない
        addLog(`${spell.name}！ ${t.name}のHPが${heal}回復した。`);
      }
    } else if (spell.power === 'poison_cure') {
      // 解毒呪文
      const t = Party.members[cmd.target];
      if (t && t.status === 'poisoned') {
        t.status = 'ok';
        addLog(`${t.name}の毒が治った！`);
      }
    }
  }
}

/**
 * アイテムを使用する
 *
 * @param {object} char - アイテムを使うキャラクター
 * @param {object} cmd  - { type:'item', itemId, target }
 */
function useItem(char, cmd) {
  const item = DB.items[cmd.itemId];
  if (!item) return;

  // アイテムを持っているか確認して、持っていれば1個取り除く
  const idx = char.items.indexOf(cmd.itemId);
  if (idx === -1) { addLog('アイテムを持っていない。'); return; }
  char.items.splice(idx, 1); // インベントリから1個消費

  if (item.type === 'heal') {
    // HP 回復アイテム（effect = "hp:30" → 30 HP 回復）
    const hp = Number(item.effect.replace('hp:', ''));
    const t  = Party.members[cmd.target] || char; // 対象がいなければ自分
    t.hp = Math.min(t.hp + hp, t.maxHp);
    addLog(`${char.name}が${item.name}を使った！ ${t.name}のHPが${hp}回復。`);
  } else if (item.type === 'cure') {
    // 状態異常回復アイテム
    const t = Party.members[cmd.target] || char;
    t.status = 'ok';
    addLog(`${char.name}が${item.name}を使った！ ${t.name}の状態が回復。`);
  }
}

/**
 * 敵の攻撃処理（AIの行動）
 *
 * @param {object} enemy - 行動する敵キャラクター
 *
 * ロジック：
 *   1. 眠っていたら30%で目覚めて終了
 *   2. 行動可能な味方（プレイヤー）からランダムに対象を選ぶ
 *   3. attacks 回だけ攻撃を試みる（一部モンスターは複数回攻撃）
 *   4. 命中したら damage ダイスでダメージ、特殊能力（毒など）も判定
 */
function execEnemyAttack(enemy) {
  // 眠り状態のチェック：30% で目覚める
  if (enemy._asleep) {
    if (Math.random() < 0.3) { enemy._asleep = false; addLog(`${enemy.name}は目を覚ました！`); }
    return; // 眠っている間は攻撃しない
  }

  // 行動可能な味方キャラをすべて取得
  const targets = Party.members.filter(isActive);
  if (targets.length === 0) return; // 全員倒れていたら何もしない

  // attacks の回数だけ攻撃を繰り返す
  for (let i = 0; i < enemy.attacks; i++) {
    // ランダムに対象を1人選ぶ
    const t = targets[Math.floor(Math.random() * targets.length)];

    // 命中判定：1d20 + モンスターレベル が 対象AC + 10 を超えれば命中
    const hitRoll = rollDice('1d20') + enemy.level;
    if (hitRoll > t.ac + 10) {
      const dmg = rollDice(enemy.damage);
      t.hp -= dmg;
      addLog(`${enemy.name}の攻撃！ ${t.name}に${dmg}ダメージ。`);

      // 毒の特殊能力チェック：30% で毒にする
      if (enemy.special.includes('poison') && Math.random() < 0.3 && t.status === 'ok') {
        t.status = 'poisoned';
        addLog(`${t.name}は毒に侵された！`);
      }

      // HP がゼロ以下になったら死亡扱い
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

/**
 * 戦闘勝利時の報酬（経験値・ゴールド）を配布する
 *
 * ロジック：
 *   1. 全倒した敵の EXP・Gold を合計する
 *   2. ゴールドをパーティの所持金に加算
 *   3. 生存メンバー全員で EXP を均等に分割
 *   4. レベルアップチェックを行う
 */
function giveRewards() {
  let totalExp = 0, totalGold = 0;
  for (const e of _enemies) {
    totalExp  += e.exp;
    // gold は「最大Gold + 1 面のダイス - 1」= 0〜gold のランダム値
    totalGold += rollDice(`1d${e.gold + 1}`) - 1;
  }
  Party.gold += totalGold; // 所持金に加算

  const alive   = Party.members.filter(isActive);
  const expEach = alive.length > 0 ? Math.floor(totalExp / alive.length) : 0; // 均等分割

  for (const c of alive) {
    c.exp += expEach;
    if (checkLevelUp(c)) {
      addLog(`${c.name}はレベル${c.level}に上がった！`);
    }
  }
  addLog(`戦闘終了。${totalExp}EXP と ${totalGold}G を獲得。`);
}

/**
 * 戦闘を終了してリザルト画面を表示する
 * @param {boolean} win   - 勝利したか
 * @param {boolean} fled  - 逃走したか
 */
function endBattle(win, fled) {
  _phase = 'result';
  renderBattle({ enemies: _enemies, log: _log, phase: 'result', win, fled, cmds: _cmds, cmdIndex: _cmdIndex });
}

/**
 * リザルト画面の「続ける」ボタンが押されたときの処理
 * battleUI.js から呼ばれる
 */
export function battleContinue() {
  if (_afterBattle) _afterBattle(); // 戦闘前に登録したコールバックを実行
}

/**
 * バトルログにメッセージを追加する内部ヘルパー
 * @param {string} msg - 追加するメッセージ
 */
function addLog(msg) { _log.push(msg); }

/**
 * 現在のバトル状態を外部から取得する（デバッグやUI更新用）
 * @returns {object} バトル状態オブジェクト
 */
export function getBattleState() {
  return { enemies: _enemies, log: _log, phase: _phase, cmdIndex: _cmdIndex, cmds: _cmds };
}


