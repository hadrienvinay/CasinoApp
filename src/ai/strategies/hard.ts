import { ActionType, Card, GameState, Phase, PlayerAction, PokerVariant } from '@/engine/types';
import { AIStrategy } from './base';
import {
  getHandStrength,
  getStartingHandTier,
  getPreFlopStrength,
  getPotOdds,
  countOuts,
  getEffectiveStackBB,
  HandTier,
  RANK_VALUES,
} from '../evaluator';

// Simple opponent model: track aggression based on recent actions
const opponentHistory: { raises: number; calls: number; folds: number } = {
  raises: 0,
  calls: 0,
  folds: 0,
};

export function recordHumanAction(actionType: ActionType): void {
  if (actionType === ActionType.Raise || actionType === ActionType.AllIn) {
    opponentHistory.raises++;
  } else if (actionType === ActionType.Call) {
    opponentHistory.calls++;
  } else if (actionType === ActionType.Fold) {
    opponentHistory.folds++;
  }
  // Keep a rolling window — decay old data
  const total = opponentHistory.raises + opponentHistory.calls + opponentHistory.folds;
  if (total > 30) {
    opponentHistory.raises = Math.round(opponentHistory.raises * 0.7);
    opponentHistory.calls = Math.round(opponentHistory.calls * 0.7);
    opponentHistory.folds = Math.round(opponentHistory.folds * 0.7);
  }
}

function getOpponentAggressionFactor(): number {
  const total = opponentHistory.raises + opponentHistory.calls + opponentHistory.folds;
  if (total < 5) return 0.5; // Unknown, assume neutral
  return opponentHistory.raises / total;
}

function getOpponentFoldFrequency(): number {
  const total = opponentHistory.raises + opponentHistory.calls + opponentHistory.folds;
  if (total < 5) return 0.4;
  return opponentHistory.folds / total;
}

export class HardStrategy implements AIStrategy {
  decide(
    holeCards: Card[],
    communityCards: Card[],
    gameState: GameState,
    availableActions: PlayerAction[],
  ): PlayerAction {
    const fold = availableActions.find((a) => a.type === ActionType.Fold);
    const check = availableActions.find((a) => a.type === ActionType.Check);
    const call = availableActions.find((a) => a.type === ActionType.Call);
    const raise = availableActions.find((a) => a.type === ActionType.Raise);
    const allIn = availableActions.find((a) => a.type === ActionType.AllIn);
    const actions: ActionSet = { fold, check, call, raise, allIn };

    const position = this.getPositionType(gameState);

    if (communityCards.length === 0) {
      return this.preFlopDecision(holeCards, gameState, actions, position);
    }

    return this.postFlopDecision(holeCards, communityCards, gameState, actions, position);
  }

  private getPositionType(
    gameState: GameState,
  ): 'early' | 'middle' | 'late' {
    const activePlayers = gameState.players.filter((p) => !p.isFolded && p.chips > 0);
    const count = activePlayers.length;
    const activeIdx = gameState.activePlayerIndex;
    const dealerIdx = gameState.dealerIndex;
    const totalPlayers = gameState.players.length;

    const posFromDealer = (activeIdx - dealerIdx + totalPlayers) % totalPlayers;

    // Heads-up: dealer/SB is "late" (acts first pre-flop but last post-flop), BB is "early"
    if (count <= 2) {
      return posFromDealer === 0 ? 'late' : 'early';
    }

    // 3 players: dealer=late, SB=early, BB=middle
    if (count === 3) {
      if (posFromDealer === 0) return 'late';
      if (posFromDealer === 1) return 'early';
      return 'middle';
    }

    // 4+ players
    if (posFromDealer === 0 || posFromDealer === totalPlayers - 1) return 'late';
    if (posFromDealer <= 2) return 'early';
    return 'middle';
  }

  private preFlopDecision(
    holeCards: Card[],
    gameState: GameState,
    actions: ActionSet,
    position: 'early' | 'middle' | 'late',
  ): PlayerAction {
    const tier = getStartingHandTier(holeCards);
    const pfStrength = getPreFlopStrength(holeCards);
    const toCall = actions.call?.amount ?? 0;
    const bigBlind = gameState.config.bigBlind;
    const player = gameState.players[gameState.activePlayerIndex];
    const stackBB = getEffectiveStackBB(player.chips + player.currentBet, bigBlind);
    const facingRaise = toCall > bigBlind;
    const facing3Bet = toCall > bigBlind * 3;
    const facing4Bet = toCall > bigBlind * 10;
    const opponentAggro = getOpponentAggressionFactor();
    const opponentFolds = getOpponentFoldFrequency();

    // ============================================
    // SHORT STACK: Push/Fold (< 12 BB)
    // ============================================
    if (stackBB <= 12) {
      return this.pushFoldDecision(holeCards, tier, pfStrength, stackBB, position, actions, facingRaise, opponentAggro);
    }

    // ============================================
    // MEDIUM STACK (12-25 BB): Shove or fold 3-bet
    // ============================================
    if (stackBB <= 25) {
      return this.mediumStackPreflop(holeCards, tier, pfStrength, stackBB, position, actions, facingRaise, facing3Bet, opponentAggro, gameState);
    }

    // ============================================
    // DEEP STACK (> 25 BB)
    // ============================================
    return this.deepStackPreflop(holeCards, tier, pfStrength, position, actions, facingRaise, facing3Bet, facing4Bet, opponentAggro, opponentFolds, gameState);
  }

  private pushFoldDecision(
    _holeCards: Card[],
    tier: HandTier,
    pfStrength: number,
    stackBB: number,
    position: 'early' | 'middle' | 'late',
    actions: ActionSet,
    facingRaise: boolean,
    opponentAggro: number,
  ): PlayerAction {
    // Ultra short (< 6 BB): push wide
    if (stackBB <= 6) {
      if (position === 'late' && tier !== 'trash') {
        return actions.allIn ?? actions.raise ?? actions.call!;
      }
      // Push any pair, any ace, K8+, suited connectors
      if (pfStrength >= 0.35) {
        return actions.allIn ?? actions.raise ?? actions.call!;
      }
      if (actions.check) return actions.check;
      return actions.fold!;
    }

    // 6-12 BB: tighter push range
    if (facingRaise) {
      // Call a shove: need premium or strong
      if (pfStrength >= 0.70) return actions.allIn ?? actions.call!;
      // Call with strong if opponent is aggro
      if (pfStrength >= 0.55 && opponentAggro > 0.4) {
        return actions.allIn ?? actions.call!;
      }
      if (actions.check) return actions.check;
      return actions.fold!;
    }

    // Open shove ranges by position
    const pushThreshold = position === 'late' ? 0.35
      : position === 'middle' ? 0.45
      : 0.55;

    if (pfStrength >= pushThreshold) {
      return actions.allIn ?? actions.raise!;
    }
    if (actions.check) return actions.check;
    return actions.fold!;
  }

  private mediumStackPreflop(
    _holeCards: Card[],
    tier: HandTier,
    pfStrength: number,
    _stackBB: number,
    position: 'early' | 'middle' | 'late',
    actions: ActionSet,
    facingRaise: boolean,
    facing3Bet: boolean,
    opponentAggro: number,
    gameState: GameState,
  ): PlayerAction {
    // Facing a 3-bet with medium stack
    if (facing3Bet) {
      // 4-bet all-in with premium
      if (tier === 'premium') return actions.allIn ?? actions.raise!;
      // Shove strong hands vs aggressive opponents
      if (tier === 'strong' && opponentAggro > 0.35) {
        return actions.allIn ?? actions.call!;
      }
      // Call with strong
      if (tier === 'strong' && actions.call) return actions.call;
      // Fold the rest
      return actions.fold ?? actions.check!;
    }

    // Facing an open raise
    if (facingRaise) {
      if (tier === 'premium') {
        // 3-bet (sizing will convert to all-in with medium stack)
        return this.sizeRaise(actions, gameState, 'large');
      }
      if (tier === 'strong') {
        // 3-bet sometimes, flat other times
        if (Math.random() < 0.4) return this.sizeRaise(actions, gameState, 'large');
        if (actions.call) return actions.call;
        return actions.fold!;
      }
      if (tier === 'playable') {
        if (actions.call) return actions.call;
        return actions.fold!;
      }
      return actions.fold ?? actions.check!;
    }

    // Open raise by position
    const shouldOpen = this.shouldPlayPreFlop(tier, position, false);
    if (!shouldOpen) {
      if (actions.check) return actions.check;
      return actions.fold!;
    }

    if (tier === 'premium' || tier === 'strong') {
      if (actions.raise) return this.sizeRaise(actions, gameState, 'medium');
      return actions.call ?? actions.check!;
    }
    if (tier === 'playable') {
      // Open raise from middle/late
      if (position !== 'early' && actions.raise && Math.random() < 0.6) {
        return this.sizeRaise(actions, gameState, 'small');
      }
      if (actions.check) return actions.check;
      if (actions.call) return actions.call;
      return actions.fold!;
    }
    // Marginal: steal from late position
    if (position === 'late' && pfStrength >= 0.30 && actions.raise && Math.random() < 0.35) {
      return this.sizeRaise(actions, gameState, 'small');
    }
    if (actions.check) return actions.check;
    return actions.fold!;
  }

  private deepStackPreflop(
    _holeCards: Card[],
    tier: HandTier,
    pfStrength: number,
    position: 'early' | 'middle' | 'late',
    actions: ActionSet,
    facingRaise: boolean,
    facing3Bet: boolean,
    facing4Bet: boolean,
    opponentAggro: number,
    opponentFolds: number,
    gameState: GameState,
  ): PlayerAction {
    const bigBlind = gameState.config.bigBlind;

    // --- Facing a 4-bet ---
    if (facing4Bet) {
      // 5-bet all-in with AA, KK
      if (pfStrength >= 0.95 && actions.allIn) return actions.allIn;
      // Call with QQ, AKs
      if (tier === 'premium' && actions.call) return actions.call;
      // Fold everything else
      return actions.fold ?? actions.check!;
    }

    // --- Facing a 3-bet ---
    if (facing3Bet) {
      if (tier === 'premium') {
        // 4-bet with premium
        if (pfStrength >= 0.90 && actions.raise) {
          return this.sizeRaise(actions, gameState, 'large');
        }
        if (actions.call) return actions.call;
        return actions.raise ?? actions.allIn!;
      }
      if (tier === 'strong') {
        // Call 3-bet with strong, sometimes 4-bet bluff
        if (actions.call) return actions.call;
        return actions.fold!;
      }
      // 3-bet bluff defense: call with suited connectors sometimes (15%)
      if (tier === 'playable' && Math.random() < 0.15 && actions.call) {
        return actions.call;
      }
      return actions.fold ?? actions.check!;
    }

    // --- Facing an open raise ---
    if (facingRaise) {
      if (tier === 'premium') {
        // 3-bet for value
        return this.sizeRaise(actions, gameState, 'large');
      }
      if (tier === 'strong') {
        // 3-bet 40% of the time, flat 60%
        if (Math.random() < 0.4 && actions.raise) {
          return this.sizeRaise(actions, gameState, 'large');
        }
        if (actions.call) return actions.call;
        return actions.fold!;
      }
      if (tier === 'playable') {
        const toCall = actions.call?.amount ?? 0;
        if (toCall > bigBlind * 4) return actions.fold!;
        if (actions.call) return actions.call;
        return actions.fold!;
      }
      // 3-bet bluff: suited aces, suited connectors from late position (12%)
      if (position === 'late' && tier === 'marginal' && Math.random() < 0.12) {
        if (actions.raise) return this.sizeRaise(actions, gameState, 'large');
      }
      return actions.fold ?? actions.check!;
    }

    // --- Open raise (no one has raised) ---
    const shouldOpen = this.shouldPlayPreFlop(tier, position, false);
    if (!shouldOpen) {
      if (actions.check) return actions.check;
      return actions.fold!;
    }

    if (tier === 'premium') {
      // Open raise larger from early, standard from late
      const sizing = position === 'early' ? 'large' : 'medium';
      return this.sizeRaise(actions, gameState, sizing);
    }
    if (tier === 'strong') {
      return this.sizeRaise(actions, gameState, 'medium');
    }
    if (tier === 'playable') {
      if (position !== 'early' && actions.raise) {
        return this.sizeRaise(actions, gameState, 'small');
      }
      if (actions.check) return actions.check;
      if (actions.call) return actions.call;
      return actions.fold!;
    }
    // Steal from late position with marginal (30%) or even trash (10%)
    if (position === 'late') {
      const stealFreq = tier === 'marginal' ? 0.40 : 0.10;
      // Steal more vs tight opponents
      const adjustedFreq = opponentFolds > 0.5 ? stealFreq * 1.5 : stealFreq;
      if (Math.random() < adjustedFreq && actions.raise) {
        return this.sizeRaise(actions, gameState, 'small');
      }
    }
    if (actions.check) return actions.check;
    return actions.fold!;
  }

  private shouldPlayPreFlop(
    tier: HandTier,
    position: 'early' | 'middle' | 'late',
    facingRaise: boolean,
  ): boolean {
    switch (position) {
      case 'early':
        return tier === 'premium' || tier === 'strong';
      case 'middle':
        if (facingRaise) return tier === 'premium' || tier === 'strong';
        return tier !== 'trash';
      case 'late':
        if (facingRaise) return tier !== 'trash' && tier !== 'marginal';
        return tier !== 'trash';
    }
  }

  // ============================================
  // POST-FLOP
  // ============================================

  private postFlopDecision(
    holeCards: Card[],
    communityCards: Card[],
    gameState: GameState,
    actions: ActionSet,
    position: 'early' | 'middle' | 'late',
  ): PlayerAction {
    const strength = getHandStrength(holeCards, communityCards);
    const outs = countOuts(holeCards, communityCards);
    const toCall = actions.call?.amount ?? 0;
    const potOdds = getPotOdds(toCall, gameState.pot);
    const opponentAggro = getOpponentAggressionFactor();
    const scaryBoard = this.isScaryBoard(communityCards);
    const isRiver = gameState.phase === Phase.River;
    const pot = gameState.pot;
    const bigBlind = gameState.config.bigBlind;
    const player = gameState.players[gameState.activePlayerIndex];
    const stackBB = getEffectiveStackBB(player.chips, bigBlind);

    // --- Monster (full house+) ---
    if (strength >= 0.90) {
      // Trap: slow-play 35% from early position, 20% from late
      const trapFreq = position === 'early' ? 0.35 : 0.20;
      if (Math.random() < trapFreq && actions.check) return actions.check;
      // Otherwise raise big / all-in if short
      if (stackBB <= 15 && actions.allIn) return actions.allIn;
      if (actions.raise) return this.sizeRaise(actions, gameState, 'large');
      if (actions.call) return actions.call;
      return actions.allIn ?? actions.check!;
    }

    // --- Very strong (flush, straight, trips) ---
    if (strength >= 0.70) {
      // Value bet / raise
      if (actions.raise) {
        const sizing = strength >= 0.80 ? 'large' : 'medium';
        return this.sizeRaise(actions, gameState, sizing);
      }
      if (actions.call) return actions.call;
      return actions.check ?? actions.allIn!;
    }

    // --- Good hand (two pair, strong top pair) ---
    if (strength >= 0.45) {
      if (actions.check) {
        // Bet for value from late position (55%) or any position with strong hand (40%)
        const betFreq = position === 'late' ? 0.55 : 0.40;
        if (Math.random() < betFreq && actions.raise) {
          return this.sizeRaise(actions, gameState, 'small');
        }
        return actions.check;
      }
      // Facing a bet: call if reasonable
      if (toCall <= pot * 0.75 && actions.call) return actions.call;
      // Fold to overbets with marginal hands if opponent isn't super aggro
      if (toCall > pot && strength < 0.55 && opponentAggro < 0.35) {
        return actions.fold!;
      }
      if (actions.call) return actions.call;
      return actions.fold!;
    }

    // --- Drawing hands (flush draw, OESD): 8+ outs ---
    if (outs >= 8 && !isRiver) {
      const impliedOdds = outs / 46;

      // Semi-bluff raise: more from late position, on scary boards
      const semiBluffFreq = position === 'late' ? 0.35 : (scaryBoard ? 0.25 : 0.15);
      if (actions.check && Math.random() < semiBluffFreq && actions.raise) {
        return this.sizeRaise(actions, gameState, 'medium');
      }
      if (actions.check) return actions.check;

      // Call if pot odds (or close) justify it
      if (impliedOdds > potOdds * 0.7 && actions.call) return actions.call;
      // Call small bets even with worse odds
      if (toCall <= bigBlind * 3 && actions.call) return actions.call;
      return actions.fold!;
    }

    // --- Gutshot (4 outs) ---
    if (outs >= 4 && !isRiver) {
      const impliedOdds = outs / 46;
      if (actions.check) return actions.check;
      if (impliedOdds > potOdds && actions.call) return actions.call;
      // Semi-bluff with gutshot + overcards sometimes
      if (strength >= 0.15 && Math.random() < 0.10 && actions.raise) {
        return this.sizeRaise(actions, gameState, 'small');
      }
      return actions.fold!;
    }

    // --- Bluff opportunities ---
    if (this.shouldBluff(gameState, communityCards, strength, position, scaryBoard, outs)) {
      if (actions.check && actions.raise) {
        return this.sizeRaise(actions, gameState, scaryBoard ? 'large' : 'medium');
      }
      // Bluff-raise facing a bet (check-raise bluff, rare)
      if (!actions.check && Math.random() < 0.08 && actions.raise) {
        return this.sizeRaise(actions, gameState, 'large');
      }
    }

    // --- Weak hand ---
    if (actions.check) return actions.check;

    // Call small bets occasionally with marginal hands
    if (strength >= 0.20 && toCall <= bigBlind * 2 && actions.call) {
      return actions.call;
    }

    return actions.fold!;
  }

  private shouldBluff(
    gameState: GameState,
    _communityCards: Card[],
    strength: number,
    position: 'early' | 'middle' | 'late',
    scaryBoard: boolean,
    outs: number,
  ): boolean {
    // Don't bluff from early position (unless check-raising)
    if (position === 'early') return false;

    // Need some backup equity to bluff (not total air)
    if (strength < 0.05 && outs === 0) return false;

    const opponentAggro = getOpponentAggressionFactor();
    const opponentFolds = getOpponentFoldFrequency();

    // Don't bluff calling stations or very aggressive opponents
    if (opponentAggro > 0.45) return false;

    // Bluff more vs tight/foldy opponents
    const foldBonus = opponentFolds > 0.5 ? 1.6 : 1.0;

    // Stack depth adjustment: bluff less when short-stacked (higher commitment)
    const player = gameState.players[gameState.activePlayerIndex];
    const stackBB = getEffectiveStackBB(player.chips, gameState.config.bigBlind);
    const stackMultiplier = stackBB < 15 ? 0.4 : stackBB < 25 ? 0.7 : 1.0;

    // Base bluff frequency by street
    const phase = gameState.phase;
    let bluffFreq: number;

    if (phase === Phase.River) {
      // River bluff: representing a made hand
      // Missed draws are good bluff candidates
      bluffFreq = outs > 0 ? 0.18 : 0.08;
    } else if (phase === Phase.Turn) {
      bluffFreq = 0.12;
    } else {
      bluffFreq = 0.10;
    }

    // Scary boards = more bluffs (represent the draw/made hand)
    if (scaryBoard) bluffFreq *= 1.5;

    return Math.random() < bluffFreq * foldBonus * stackMultiplier;
  }

  private isScaryBoard(communityCards: Card[]): boolean {
    if (communityCards.length < 3) return false;

    // Three to a flush
    const suitCounts = new Map<string, number>();
    for (const c of communityCards) {
      suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
    }
    if (Array.from(suitCounts.values()).some((count) => count >= 3)) return true;

    // Three to a straight (three consecutive ranks on board)
    const ranks = communityCards
      .map((c) => RANK_VALUES[c.rank])
      .sort((a, b) => a - b);
    for (let i = 0; i <= ranks.length - 3; i++) {
      if (ranks[i + 2] - ranks[i] <= 4) return true;
    }

    // Paired board
    const rankSet = new Set(communityCards.map((c) => c.rank));
    if (rankSet.size < communityCards.length) return true;

    return false;
  }

  private sizeRaise(
    actions: ActionSet,
    gameState: GameState | null,
    sizing: 'small' | 'medium' | 'large',
  ): PlayerAction {
    if (!actions.raise) return actions.call ?? actions.allIn!;

    const minRaise = actions.raise.amount;

    if (!gameState) {
      if (sizing === 'large' && actions.allIn) return actions.allIn;
      return actions.raise;
    }

    const player = gameState.players[gameState.activePlayerIndex];
    const maxRaise = player.chips;
    const pot = gameState.pot;

    let targetAmount: number;
    switch (sizing) {
      case 'small':
        // 50-60% pot
        targetAmount = Math.min(
          minRaise + Math.floor(pot * 0.33),
          maxRaise,
        );
        break;
      case 'medium':
        // 66-75% pot
        targetAmount = Math.min(
          minRaise + Math.floor(pot * 0.6),
          maxRaise,
        );
        break;
      case 'large':
        // Full pot or overbet
        targetAmount = Math.min(
          minRaise + Math.floor(pot * 0.9),
          maxRaise,
        );
        break;
    }

    // If the sized raise would be close to all-in, just go all-in
    if (targetAmount > maxRaise * 0.75 && actions.allIn) {
      return actions.allIn;
    }

    return { type: ActionType.Raise, amount: Math.max(minRaise, targetAmount) };
  }

  decideDiscard(holeCards: Card[], variant: PokerVariant): number[] {
    if (variant === PokerVariant.TripleDraw27 || variant === PokerVariant.Razz) {
      const rankValues: Record<string, number> = {
        'A': variant === PokerVariant.Razz ? 1 : 14,
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
        '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13,
      };

      const indexed = holeCards.map((c, i) => ({
        index: i,
        value: rankValues[c.rank] ?? 10,
      }));
      indexed.sort((a, b) => a.value - b.value);

      const keepCount = Math.min(4, indexed.filter((c) => c.value <= 7).length);
      const toDiscard = indexed.slice(keepCount).map((c) => c.index);
      return toDiscard.slice(0, 3);
    }

    const rankCounts = new Map<string, number[]>();
    for (let i = 0; i < holeCards.length; i++) {
      const rank = holeCards[i].rank;
      if (!rankCounts.has(rank)) rankCounts.set(rank, []);
      rankCounts.get(rank)!.push(i);
    }

    const keepIndices = new Set<number>();

    for (const [, indices] of rankCounts) {
      if (indices.length >= 2) {
        indices.forEach((idx) => keepIndices.add(idx));
      }
    }

    if (keepIndices.size === 0) {
      const highValues: Record<string, number> = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
        '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
      };
      const indexed = holeCards.map((c, i) => ({
        index: i,
        value: highValues[c.rank] ?? 2,
      }));
      indexed.sort((a, b) => b.value - a.value);
      indexed.slice(0, 2).forEach((c) => keepIndices.add(c.index));
    }

    const discardIndices: number[] = [];
    for (let i = 0; i < holeCards.length; i++) {
      if (!keepIndices.has(i)) discardIndices.push(i);
    }
    return discardIndices.slice(0, 3);
  }
}

interface ActionSet {
  fold: PlayerAction | undefined;
  check: PlayerAction | undefined;
  call: PlayerAction | undefined;
  raise: PlayerAction | undefined;
  allIn: PlayerAction | undefined;
}
