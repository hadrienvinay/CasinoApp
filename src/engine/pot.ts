import { Player, SidePot } from './types';

export function calculateSidePots(players: Player[]): SidePot[] {
  // Use totalBet (cumulative across all betting rounds) for correct side pot calculation.
  // All players who put money in contribute to pot amounts.
  // Only non-folded players are eligible to win.
  const contributors = players.filter((p) => p.totalBet > 0);
  if (contributors.length === 0) return [];

  // Get all unique bet levels, sorted ascending
  const levels = [...new Set(contributors.map((p) => p.totalBet))].sort((a, b) => a - b);

  const pots: SidePot[] = [];
  let previousLevel = 0;

  for (const level of levels) {
    const marginal = level - previousLevel;
    if (marginal <= 0) continue;

    // Everyone whose totalBet >= level contributes the full marginal at this tier
    const count = contributors.filter((p) => p.totalBet >= level).length;
    const amount = marginal * count;

    // Only non-folded players with totalBet >= level can win this pot
    const eligible = contributors.filter((p) => !p.isFolded && p.totalBet >= level);

    if (amount > 0) {
      if (eligible.length > 0) {
        pots.push({ amount, eligiblePlayerIds: eligible.map((p) => p.id) });
      } else if (pots.length > 0) {
        // Dead money (only folded players at this level) — add to previous pot
        pots[pots.length - 1].amount += amount;
      }
    }

    previousLevel = level;
  }

  return pots;
}

export function distributePots(
  sidePots: SidePot[],
  winnersByPot: Map<number, string[]>,
): Map<string, number> {
  const winnings = new Map<string, number>();

  sidePots.forEach((pot, index) => {
    const winners = winnersByPot.get(index) ?? [];
    if (winners.length === 0) return;

    const share = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount % winners.length;

    winners.forEach((id, i) => {
      const current = winnings.get(id) ?? 0;
      winnings.set(id, current + share + (i === 0 ? remainder : 0));
    });
  });

  return winnings;
}
