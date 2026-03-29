import { Card, Rank, Suit } from './types';

const ALL_SUITS = Object.values(Suit);
const ALL_RANKS = Object.values(Rank);

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function shuffle(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    const j = randomBytes[0] % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function deal(deck: Card[], count: number): { dealt: Card[]; remaining: Card[] } {
  return {
    dealt: deck.slice(0, count),
    remaining: deck.slice(count),
  };
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function cardFromString(str: string): Card {
  return {
    rank: str[0] as Rank,
    suit: str[1] as Suit,
  };
}
