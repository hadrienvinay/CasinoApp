import { describe, it, expect } from 'vitest';
import { evaluateHand, compareHands } from '../hand-evaluator';
import { cardFromString } from '../deck';
import { Card } from '../types';

function cards(...strs: string[]): Card[] {
  return strs.map(cardFromString);
}

describe('hand-evaluator', () => {
  it('should detect a royal flush', () => {
    const hole = cards('Ah', 'Kh');
    const community = cards('Qh', 'Jh', 'Th', '2c', '3d');
    const result = evaluateHand(hole, community);
    // pokersolver reports Royal Flush as "Straight Flush"
    expect(result.name).toBe('Straight Flush');
  });

  it('should detect a straight flush', () => {
    const hole = cards('9h', '8h');
    const community = cards('7h', '6h', '5h', '2c', '3d');
    const result = evaluateHand(hole, community);
    expect(result.name).toBe('Straight Flush');
  });

  it('should detect four of a kind', () => {
    const hole = cards('Ah', 'Ad');
    const community = cards('Ac', 'As', 'Kh', '2c', '3d');
    const result = evaluateHand(hole, community);
    expect(result.name).toBe('Four of a Kind');
  });

  it('should detect a full house', () => {
    const hole = cards('Ah', 'Ad');
    const community = cards('Ac', 'Kh', 'Ks', '2c', '3d');
    const result = evaluateHand(hole, community);
    expect(result.name).toBe('Full House');
  });

  it('should detect a flush', () => {
    const hole = cards('Ah', '9h');
    const community = cards('6h', '3h', '2h', 'Kc', 'Td');
    const result = evaluateHand(hole, community);
    expect(result.name).toBe('Flush');
  });

  it('should detect a straight', () => {
    const hole = cards('9h', '8d');
    const community = cards('7c', '6s', '5h', '2c', '3d');
    const result = evaluateHand(hole, community);
    expect(result.name).toBe('Straight');
  });

  it('should detect three of a kind', () => {
    const hole = cards('Ah', 'Ad');
    const community = cards('Ac', '7s', '5h', '2c', '3d');
    const result = evaluateHand(hole, community);
    expect(result.name).toBe('Three of a Kind');
  });

  it('should detect two pair', () => {
    const hole = cards('Ah', 'Kd');
    const community = cards('Ac', 'Ks', '5h', '2c', '3d');
    const result = evaluateHand(hole, community);
    expect(result.name).toBe('Two Pair');
  });

  it('should detect a pair', () => {
    const hole = cards('Ah', '7d');
    const community = cards('Ac', '9s', '5h', '2c', '3d');
    const result = evaluateHand(hole, community);
    expect(result.name).toBe('Pair');
  });

  it('should compare hands and pick the winner', () => {
    const community = cards('Th', '9h', '8h', '2c', '3d');
    const winners = compareHands(
      [
        { playerId: 'p1', holeCards: cards('Ah', 'Kh') },
        { playerId: 'p2', holeCards: cards('7s', '6s') },
      ],
      community,
    );
    expect(winners).toHaveLength(1);
    expect(winners[0].playerId).toBe('p1');
  });

  it('should handle split pot (tie)', () => {
    const community = cards('Th', '9h', '8c', '7d', '6s');
    const winners = compareHands(
      [
        { playerId: 'p1', holeCards: cards('2c', '3d') },
        { playerId: 'p2', holeCards: cards('2s', '3s') },
      ],
      community,
    );
    expect(winners).toHaveLength(2);
  });
});
