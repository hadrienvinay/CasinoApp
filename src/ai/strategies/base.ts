import { Card, GameState, PlayerAction, PokerVariant } from '@/engine/types';

export interface AIStrategy {
  decide(
    holeCards: Card[],
    communityCards: Card[],
    gameState: GameState,
    availableActions: PlayerAction[],
  ): PlayerAction;

  decideDiscard?(holeCards: Card[], variant: PokerVariant): number[];
}
