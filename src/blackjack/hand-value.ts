import { Card, Rank } from '@/engine/types';
import { BJHand } from './types';

const POINT_VALUES: Record<Rank, number> = {
  [Rank.Two]: 2,
  [Rank.Three]: 3,
  [Rank.Four]: 4,
  [Rank.Five]: 5,
  [Rank.Six]: 6,
  [Rank.Seven]: 7,
  [Rank.Eight]: 8,
  [Rank.Nine]: 9,
  [Rank.Ten]: 10,
  [Rank.Jack]: 10,
  [Rank.Queen]: 10,
  [Rank.King]: 10,
  [Rank.Ace]: 11,
};

export interface HandValue {
  hard: number;
  soft: number;
  best: number;
  isSoft: boolean;
  isBust: boolean;
  isBlackjack: boolean;
}

export function cardPointValue(rank: Rank): number {
  return POINT_VALUES[rank];
}

export function calculateHandValue(cards: Card[]): HandValue {
  let total = 0;
  let aceCount = 0;

  for (const card of cards) {
    total += POINT_VALUES[card.rank];
    if (card.rank === Rank.Ace) aceCount++;
  }

  // Hard value: count aces as 1 where needed
  let hard = total;
  while (hard > 21 && aceCount > 0) {
    hard -= 10;
    aceCount--;
  }

  const soft = total; // before reducing aces
  const best = hard;
  const isSoft = best !== soft && best <= 21;
  const isBust = best > 21;
  const isBlackjack = cards.length === 2 && best === 21;

  return { hard, soft, best, isSoft, isBust, isBlackjack };
}

export function canSplit(hand: BJHand): boolean {
  if (hand.cards.length !== 2) return false;
  return cardPointValue(hand.cards[0].rank) === cardPointValue(hand.cards[1].rank);
}

export function canDoubleDown(hand: BJHand): boolean {
  return hand.cards.length === 2 && !hand.isDoubled;
}

export function formatHandValue(cards: Card[]): string {
  const value = calculateHandValue(cards);
  if (value.isBlackjack) return 'BJ';
  if (value.isBust) return `${value.best} BUST`;
  if (value.isSoft && value.best < 21) return `${value.best}`;
  return `${value.best}`;
}
