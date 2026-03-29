import { describe, it, expect } from 'vitest';
import { createDeck, shuffle, deal, cardToString, cardFromString } from '../deck';

describe('deck', () => {
  it('should create a 52-card deck', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
  });

  it('should have all unique cards', () => {
    const deck = createDeck();
    const strings = deck.map(cardToString);
    const unique = new Set(strings);
    expect(unique.size).toBe(52);
  });

  it('should shuffle the deck (different order)', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    expect(shuffled).toHaveLength(52);
    // Extremely unlikely to be in same order
    const sameOrder = deck.every(
      (c, i) => cardToString(c) === cardToString(shuffled[i]),
    );
    expect(sameOrder).toBe(false);
  });

  it('should preserve all cards after shuffle', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    const originalSet = new Set(deck.map(cardToString));
    const shuffledSet = new Set(shuffled.map(cardToString));
    expect(shuffledSet).toEqual(originalSet);
  });

  it('should deal cards and return remaining', () => {
    const deck = createDeck();
    const { dealt, remaining } = deal(deck, 5);
    expect(dealt).toHaveLength(5);
    expect(remaining).toHaveLength(47);
  });

  it('should convert card to/from string', () => {
    const card = cardFromString('Ah');
    expect(card.rank).toBe('A');
    expect(card.suit).toBe('h');
    expect(cardToString(card)).toBe('Ah');
  });
});
