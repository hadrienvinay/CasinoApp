import { ActionType, Card, GameState, PlayerAction, PokerVariant } from '@/engine/types';
import { AIStrategy } from './base';

export class EasyStrategy implements AIStrategy {
  decide(
    _holeCards: Card[],
    _communityCards: Card[],
    _gameState: GameState,
    availableActions: PlayerAction[],
  ): PlayerAction {
    const rand = Math.random();

    const fold = availableActions.find((a) => a.type === ActionType.Fold);
    const check = availableActions.find((a) => a.type === ActionType.Check);
    const call = availableActions.find((a) => a.type === ActionType.Call);
    const raise = availableActions.find((a) => a.type === ActionType.Raise);

    // If we can check, mostly check with some raises
    if (check) {
      if (rand < 0.75) return check;
      if (raise && rand < 0.9) return raise;
      return check;
    }

    // Facing a bet: 70% call, 20% fold, 10% raise
    if (rand < 0.7 && call) return call;
    if (rand < 0.9 && fold) return fold!;
    if (raise) return raise;
    if (call) return call;

    return fold ?? availableActions[0];
  }

  decideDiscard(holeCards: Card[], variant: PokerVariant): number[] {
    // Simple strategy: randomly discard 0-3 cards
    const discardCount = Math.floor(Math.random() * 4); // 0-3 cards
    if (discardCount === 0) return [];

    // For lowball variants, discard high cards
    if (variant === PokerVariant.TripleDraw27 || variant === PokerVariant.Razz) {
      return this.discardHighCards(holeCards, variant);
    }

    // For standard draw games, keep pairs and discard random cards
    return this.discardForHighHand(holeCards, discardCount);
  }

  private discardHighCards(holeCards: Card[], variant: PokerVariant): number[] {
    const rankValues: Record<string, number> = {
      'A': variant === PokerVariant.Razz ? 1 : 14,
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
      '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13,
    };

    // Discard cards with value > 8 (for lowball, these are bad)
    const threshold = 8;
    const indices: number[] = [];

    for (let i = 0; i < holeCards.length; i++) {
      const val = rankValues[holeCards[i].rank] ?? 10;
      if (val > threshold) {
        indices.push(i);
      }
    }

    // Don't discard more than 3
    return indices.slice(0, 3);
  }

  private discardForHighHand(
    holeCards: Card[],
    maxDiscard: number,
  ): number[] {
    // Keep pairs, discard non-paired cards randomly
    const rankCounts = new Map<string, number[]>();
    for (let i = 0; i < holeCards.length; i++) {
      const rank = holeCards[i].rank;
      if (!rankCounts.has(rank)) rankCounts.set(rank, []);
      rankCounts.get(rank)!.push(i);
    }

    // Find indices of non-paired cards
    const nonPairedIndices: number[] = [];
    for (const [, indices] of rankCounts) {
      if (indices.length === 1) {
        nonPairedIndices.push(indices[0]);
      }
    }

    // Shuffle and take up to maxDiscard
    const shuffled = nonPairedIndices.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(maxDiscard, shuffled.length));
  }
}
