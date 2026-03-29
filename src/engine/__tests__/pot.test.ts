import { describe, it, expect } from 'vitest';
import { calculateSidePots, distributePots } from '../pot';
import { Player } from '../types';

function makePlayer(id: string, chips: number, totalBet: number, opts: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    chips,
    holeCards: null,
    isHuman: false,
    isFolded: false,
    isAllIn: false,
    currentBet: 0,
    totalBet,
    seatIndex: 0,
    hasActed: false,
    ...opts,
  };
}

describe('pot', () => {
  it('should create a single pot when no all-ins', () => {
    const players = [
      makePlayer('p1', 900, 100),
      makePlayer('p2', 900, 100),
      makePlayer('p3', 900, 100),
    ];
    const pots = calculateSidePots(players);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(300);
    expect(pots[0].eligiblePlayerIds).toHaveLength(3);
  });

  it('should create side pots with one all-in', () => {
    const players = [
      makePlayer('p1', 0, 300, { isAllIn: true }),
      makePlayer('p2', 200, 500),
      makePlayer('p3', 200, 500),
    ];
    const pots = calculateSidePots(players);
    expect(pots).toHaveLength(2);
    expect(pots[0].amount).toBe(900); // 300 * 3
    expect(pots[0].eligiblePlayerIds).toHaveLength(3);
    expect(pots[1].amount).toBe(400); // 200 * 2
    expect(pots[1].eligiblePlayerIds).toHaveLength(2);
  });

  it('should create multiple side pots', () => {
    const players = [
      makePlayer('p1', 0, 100, { isAllIn: true }),
      makePlayer('p2', 0, 300, { isAllIn: true }),
      makePlayer('p3', 0, 800, { isAllIn: true }),
    ];
    const pots = calculateSidePots(players);
    expect(pots).toHaveLength(3);
    expect(pots[0].amount).toBe(300);  // 100 * 3
    expect(pots[1].amount).toBe(400);  // 200 * 2
    expect(pots[2].amount).toBe(500);  // 500 * 1
  });

  it('should include folded players contributions but exclude them from eligible', () => {
    const players = [
      makePlayer('p1', 900, 100),
      makePlayer('p2', 950, 50, { isFolded: true }),
      makePlayer('p3', 900, 100),
    ];
    const pots = calculateSidePots(players);
    // Two tiers: level 50 (all 3 contribute) and level 100 (p1 + p3)
    // Folded p2's contribution is included in pot amounts but p2 is not eligible
    expect(pots).toHaveLength(2);
    expect(pots[0].amount).toBe(150); // 50 * 3
    expect(pots[0].eligiblePlayerIds).toEqual(expect.arrayContaining(['p1', 'p3']));
    expect(pots[0].eligiblePlayerIds).toHaveLength(2);
    expect(pots[1].amount).toBe(100); // 50 * 2
    expect(pots[1].eligiblePlayerIds).toEqual(expect.arrayContaining(['p1', 'p3']));
    expect(pots[1].eligiblePlayerIds).toHaveLength(2);
  });

  it('should distribute pots to winners', () => {
    const sidePots = [
      { amount: 900, eligiblePlayerIds: ['p1', 'p2', 'p3'] },
      { amount: 400, eligiblePlayerIds: ['p2', 'p3'] },
    ];
    const winnersByPot = new Map([
      [0, ['p1']],
      [1, ['p2']],
    ]);
    const winnings = distributePots(sidePots, winnersByPot);
    expect(winnings.get('p1')).toBe(900);
    expect(winnings.get('p2')).toBe(400);
  });

  it('should split pot evenly among tied winners', () => {
    const sidePots = [
      { amount: 1000, eligiblePlayerIds: ['p1', 'p2'] },
    ];
    const winnersByPot = new Map([
      [0, ['p1', 'p2']],
    ]);
    const winnings = distributePots(sidePots, winnersByPot);
    expect(winnings.get('p1')).toBe(500);
    expect(winnings.get('p2')).toBe(500);
  });
});
