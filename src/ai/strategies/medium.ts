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
} from '../evaluator';

export class MediumStrategy implements AIStrategy {
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

    if (communityCards.length === 0) {
      return this.preFlopDecision(holeCards, gameState, actions);
    }

    return this.postFlopDecision(holeCards, communityCards, gameState, actions);
  }

  private preFlopDecision(
    holeCards: Card[],
    gameState: GameState,
    actions: ActionSet,
  ): PlayerAction {
    const tier = getStartingHandTier(holeCards);
    const toCall = actions.call?.amount ?? 0;
    const bigBlind = gameState.config.bigBlind;
    const player = gameState.players[gameState.activePlayerIndex];
    const stackBB = getEffectiveStackBB(player.chips + player.currentBet, bigBlind);
    const facingRaise = toCall > bigBlind;
    const facingBigRaise = toCall > bigBlind * 3;
    const facing4Bet = toCall > bigBlind * 10;

    // --- Short stack push/fold (< 15 BB) ---
    if (stackBB <= 15) {
      return this.shortStackPreflop(holeCards, tier, stackBB, actions, facingRaise);
    }

    // --- Medium stack (15-30 BB) ---
    if (stackBB <= 30) {
      return this.mediumStackPreflop(tier, actions, facingRaise, facingBigRaise, gameState);
    }

    // --- Deep stack (> 30 BB) ---
    switch (tier) {
      case 'premium':
        // 3-bet / 4-bet with premium
        if (facing4Bet) {
          // 4-bet all-in with AA, KK
          const pfStr = getPreFlopStrength(holeCards);
          if (pfStr >= 0.95 && actions.allIn) return actions.allIn;
          if (actions.call) return actions.call;
          return actions.allIn ?? actions.check!;
        }
        if (facingRaise) {
          // 3-bet
          return this.sizeRaise(actions, gameState, 'large');
        }
        // Open raise
        return this.sizeRaise(actions, gameState, 'medium');

      case 'strong':
        if (facing4Bet) return actions.fold!;
        if (facingBigRaise) {
          // Call a 3-bet with JJ, TT, AQ
          if (actions.call) return actions.call;
          return actions.fold!;
        }
        if (facingRaise) {
          // 3-bet sometimes (30%)
          if (Math.random() < 0.3 && actions.raise) {
            return this.sizeRaise(actions, gameState, 'large');
          }
          if (actions.call) return actions.call;
          return actions.fold!;
        }
        // Open raise
        if (actions.raise) return this.sizeRaise(actions, gameState, 'medium');
        return actions.check!;

      case 'playable':
        if (facingBigRaise) return actions.fold!;
        if (facingRaise && toCall > bigBlind * 4) return actions.fold!;
        if (actions.check) return actions.check;
        if (actions.call) return actions.call;
        // Open raise sometimes (40%)
        if (!facingRaise && Math.random() < 0.4 && actions.raise) {
          return this.sizeRaise(actions, gameState, 'small');
        }
        return actions.fold!;

      case 'marginal':
        if (facingRaise) return actions.fold!;
        if (actions.check) return actions.check;
        if (toCall <= bigBlind && actions.call) return actions.call;
        return actions.fold!;

      case 'trash':
      default:
        // Occasional steal (8%) with trash from check position
        if (actions.check) {
          if (Math.random() < 0.08 && actions.raise) {
            return this.sizeRaise(actions, gameState, 'medium');
          }
          return actions.check;
        }
        return actions.fold!;
    }
  }

  private shortStackPreflop(
    holeCards: Card[],
    tier: HandTier,
    stackBB: number,
    actions: ActionSet,
    facingRaise: boolean,
  ): PlayerAction {
    const pfStrength = getPreFlopStrength(holeCards);

    // < 8 BB: push or fold
    if (stackBB <= 8) {
      // Push with any pair, any ace, any two broadway, suited connectors 7+
      if (tier !== 'trash' && tier !== 'marginal') {
        return actions.allIn ?? actions.raise ?? actions.call!;
      }
      // Push marginal if not facing a raise
      if (tier === 'marginal' && !facingRaise) {
        return actions.allIn ?? actions.raise ?? actions.call!;
      }
      if (actions.check) return actions.check;
      return actions.fold!;
    }

    // 8-15 BB: push with good hands, fold weak
    if (pfStrength >= 0.65) {
      // Premium/strong: shove
      return actions.allIn ?? actions.raise ?? actions.call!;
    }
    if (pfStrength >= 0.45) {
      // Playable: shove if not facing a raise
      if (!facingRaise) return actions.allIn ?? actions.raise ?? actions.call!;
      if (actions.call) return actions.call;
      return actions.fold!;
    }
    if (facingRaise) {
      // Call shoves with decent hands
      if (pfStrength >= 0.55 && actions.call) return actions.call;
      return actions.fold!;
    }
    if (actions.check) return actions.check;
    return actions.fold!;
  }

  private mediumStackPreflop(
    tier: HandTier,
    actions: ActionSet,
    facingRaise: boolean,
    facingBigRaise: boolean,
    gameState: GameState,
  ): PlayerAction {
    switch (tier) {
      case 'premium':
        // All-in vs 3-bet
        if (facingBigRaise && actions.allIn) return actions.allIn;
        return this.sizeRaise(actions, gameState, 'large');
      case 'strong':
        if (facingBigRaise) {
          if (actions.call) return actions.call;
          return actions.fold!;
        }
        if (actions.raise) return this.sizeRaise(actions, gameState, 'medium');
        if (actions.call) return actions.call;
        return actions.check!;
      case 'playable':
        if (facingRaise) {
          if (actions.call) return actions.call;
          return actions.fold!;
        }
        if (actions.raise && Math.random() < 0.5) return actions.raise;
        if (actions.check) return actions.check;
        if (actions.call) return actions.call;
        return actions.fold!;
      case 'marginal':
        if (facingRaise) return actions.fold!;
        if (actions.check) return actions.check;
        return actions.fold!;
      default:
        if (actions.check) return actions.check;
        return actions.fold!;
    }
  }

  private postFlopDecision(
    holeCards: Card[],
    communityCards: Card[],
    gameState: GameState,
    actions: ActionSet,
  ): PlayerAction {
    const strength = getHandStrength(holeCards, communityCards);
    const outs = countOuts(holeCards, communityCards);
    const toCall = actions.call?.amount ?? 0;
    const potOdds = getPotOdds(toCall, gameState.pot);
    const bigBlind = gameState.config.bigBlind;
    const isRiver = gameState.phase === Phase.River;

    // Monster (full house+): slow-play or raise big
    if (strength >= 0.90) {
      if (Math.random() < 0.2 && actions.check) return actions.check;
      if (actions.raise) return this.sizeRaise(actions, gameState, 'large');
      if (actions.call) return actions.call;
      return actions.allIn ?? actions.check!;
    }

    // Very strong (flush, straight, trips)
    if (strength >= 0.70) {
      if (actions.raise) return this.sizeRaise(actions, gameState, 'medium');
      if (actions.call) return actions.call;
      return actions.check ?? actions.allIn!;
    }

    // Good hand (two pair, top pair good kicker)
    if (strength >= 0.45) {
      if (actions.check) {
        // Bet for value sometimes
        if (Math.random() < 0.5 && actions.raise) {
          return this.sizeRaise(actions, gameState, 'small');
        }
        return actions.check;
      }
      // Call reasonable bets
      if (toCall <= gameState.pot * 0.8 && actions.call) return actions.call;
      // Fold to overbets with marginal made hands
      if (toCall > gameState.pot && strength < 0.55) return actions.fold!;
      if (actions.call) return actions.call;
      return actions.fold!;
    }

    // Drawing hand (flush draw, OESD)
    if (outs >= 8 && !isRiver) {
      const impliedOdds = outs / 46;
      // Semi-bluff raise sometimes (20%)
      if (actions.check && Math.random() < 0.20 && actions.raise) {
        return this.sizeRaise(actions, gameState, 'medium');
      }
      if (actions.check) return actions.check;
      if (impliedOdds > potOdds * 0.8 && actions.call) return actions.call;
      return actions.fold!;
    }

    // Gutshot
    if (outs >= 4 && !isRiver) {
      const impliedOdds = outs / 46;
      if (actions.check) return actions.check;
      if (impliedOdds > potOdds && actions.call) return actions.call;
      return actions.fold!;
    }

    // Bluff spot: missed draw on river or weak hand in position
    if (actions.check && this.shouldBluff(gameState, strength)) {
      if (actions.raise) return this.sizeRaise(actions, gameState, 'medium');
    }

    // Weak hand
    if (strength >= 0.20) {
      if (actions.check) return actions.check;
      if (toCall <= bigBlind * 2 && actions.call) return actions.call;
      return actions.fold!;
    }

    if (actions.check) return actions.check;
    return actions.fold!;
  }

  private shouldBluff(gameState: GameState, strength: number): boolean {
    // Need some equity to bluff
    if (strength < 0.08) return false;

    // Bluff more on river (representing made hand), less on earlier streets
    const phase = gameState.phase;
    const freq = phase === Phase.River ? 0.12 : 0.06;

    return Math.random() < freq;
  }

  private sizeRaise(
    actions: ActionSet,
    gameState: GameState | null,
    sizing: 'small' | 'medium' | 'large',
  ): PlayerAction {
    if (!actions.raise) return actions.call ?? actions.allIn!;

    const minRaise = actions.raise.amount;

    if (!gameState) {
      // No state info, just use min raise or all-in
      if (sizing === 'large' && actions.allIn) return actions.allIn;
      return actions.raise;
    }

    const player = gameState.players[gameState.activePlayerIndex];
    const maxRaise = player.chips;
    const pot = gameState.pot;

    let targetAmount: number;
    switch (sizing) {
      case 'small':
        targetAmount = minRaise;
        break;
      case 'medium':
        targetAmount = Math.min(minRaise + Math.floor(pot * 0.5), maxRaise);
        break;
      case 'large':
        targetAmount = Math.min(minRaise + Math.floor(pot * 0.8), maxRaise);
        break;
    }

    if (targetAmount > maxRaise * 0.8 && actions.allIn) {
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
      const indices: number[] = [];
      for (let i = 0; i < holeCards.length; i++) {
        if ((rankValues[holeCards[i].rank] ?? 10) > 7) {
          indices.push(i);
        }
      }
      return indices.slice(0, 3);
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

    const discardIndices: number[] = [];
    for (let i = 0; i < holeCards.length; i++) {
      if (!keepIndices.has(i)) {
        discardIndices.push(i);
      }
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
