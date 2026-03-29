import { Card, GameState, PlayerAction, PokerVariant } from '@/engine/types';
import { AIStrategy } from './strategies/base';
import { EasyStrategy } from './strategies/easy';
import { MediumStrategy } from './strategies/medium';
import { HardStrategy } from './strategies/hard';
import { AI_THINK_DELAY_MIN, AI_THINK_DELAY_MAX } from '@/engine/constants';

const strategies: Record<string, () => AIStrategy> = {
  easy: () => new EasyStrategy(),
  medium: () => new MediumStrategy(),
  hard: () => new HardStrategy(),
};

export function getAIDecision(
  difficulty: string,
  holeCards: Card[],
  communityCards: Card[],
  gameState: GameState,
  availableActions: PlayerAction[],
): PlayerAction {
  const strategy = (strategies[difficulty] ?? strategies.easy)();
  return strategy.decide(holeCards, communityCards, gameState, availableActions);
}

export function getAIDrawDecision(
  difficulty: string,
  holeCards: Card[],
  variant: PokerVariant,
): number[] {
  const strategy = (strategies[difficulty] ?? strategies.easy)();
  if (strategy.decideDiscard) {
    return strategy.decideDiscard(holeCards, variant);
  }
  // Default: discard nothing
  return [];
}

export function getAIThinkDelay(): number {
  return AI_THINK_DELAY_MIN + Math.random() * (AI_THINK_DELAY_MAX - AI_THINK_DELAY_MIN);
}
