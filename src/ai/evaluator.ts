import { Card, Rank } from '@/engine/types';

const RANK_VALUES: Record<string, number> = {
  [Rank.Two]: 2,
  [Rank.Three]: 3,
  [Rank.Four]: 4,
  [Rank.Five]: 5,
  [Rank.Six]: 6,
  [Rank.Seven]: 7,
  [Rank.Eight]: 8,
  [Rank.Nine]: 9,
  [Rank.Ten]: 10,
  [Rank.Jack]: 11,
  [Rank.Queen]: 12,
  [Rank.King]: 13,
  [Rank.Ace]: 14,
};

/**
 * Returns a hand strength value between 0 and 1.
 * Pre-flop: uses starting hand rankings.
 * Post-flop: uses a simplified evaluation based on hand rank categories.
 */
export function getHandStrength(
  holeCards: Card[],
  communityCards: Card[],
): number {
  if (communityCards.length === 0) {
    return getPreFlopStrength(holeCards);
  }
  return getPostFlopStrength(holeCards, communityCards);
}

export function getPreFlopStrength(holeCards: Card[]): number {
  const [a, b] = holeCards;
  const high = Math.max(RANK_VALUES[a.rank], RANK_VALUES[b.rank]);
  const low = Math.min(RANK_VALUES[a.rank], RANK_VALUES[b.rank]);
  const paired = a.rank === b.rank;
  const suited = a.suit === b.suit;
  const gap = high - low;

  // Pairs: AA=1.0, KK=0.95, ..., 22=0.55
  if (paired) {
    return 0.55 + ((high - 2) / 12) * 0.45;
  }

  // Base value from high card + low card
  let strength = (high + low - 4) / 24; // normalized 0-1 roughly

  // Suited bonus
  if (suited) strength += 0.06;

  // Connectedness bonus
  if (gap === 1) strength += 0.04;
  else if (gap === 2) strength += 0.02;
  else if (gap >= 5) strength -= 0.05;

  // High card premium bonus
  if (high === 14) strength += 0.08; // Ace
  if (high === 13) strength += 0.04; // King

  return Math.max(0, Math.min(1, strength));
}

function getPostFlopStrength(
  holeCards: Card[],
  communityCards: Card[],
): number {
  const allCards = [...holeCards, ...communityCards];

  // Count pairs, trips, quads
  const rankCounts = new Map<string, number>();
  for (const c of allCards) {
    rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1);
  }

  // Check how many of our hole card ranks hit the board
  const holeRankHits = holeCards.filter((hc) =>
    communityCards.some((cc) => cc.rank === hc.rank),
  ).length;

  const counts = Array.from(rankCounts.values()).sort((a, b) => b - a);

  // Check for flush
  const suitCounts = new Map<string, number>();
  for (const c of allCards) {
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  }
  const hasFlush = Array.from(suitCounts.values()).some((c) => c >= 5);

  // Check for straight
  const uniqueRanks = [...new Set(allCards.map((c) => RANK_VALUES[c.rank]))].sort(
    (a, b) => a - b,
  );
  const hasStraight = checkStraight(uniqueRanks);

  // Board info for pair evaluation
  const boardRanks = communityCards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const highestBoardRank = boardRanks[0] ?? 0;

  // Assign strength based on made hand
  if (hasFlush && hasStraight) return 0.98; // Straight flush
  if (counts[0] === 4) return 0.96; // Quads
  if (counts[0] === 3 && counts[1] >= 2) return 0.93; // Full house
  if (hasFlush) return 0.85;
  if (hasStraight) return 0.80;
  if (counts[0] === 3) {
    // Trips: distinguish set (pocket pair hit board) vs trips (board pair + hole card)
    const isPocketPairSet = holeCards[0].rank === holeCards[1].rank &&
      communityCards.some((cc) => cc.rank === holeCards[0].rank);
    return isPocketPairSet ? 0.75 : 0.70;
  }
  if (counts[0] === 2 && counts[1] === 2) {
    // Two pair - value depends on whether we use both hole cards and pair ranks
    if (holeRankHits === 2) {
      // Both hole cards paired the board — strongest two pair
      const pairValues = holeCards.map((hc) => RANK_VALUES[hc.rank]).sort((a, b) => b - a);
      // Scale from 0.58 (low two pair) to 0.67 (high two pair)
      return 0.58 + ((pairValues[0] + pairValues[1]) / 28) * 0.09;
    }
    return 0.52; // Board-aided two pair (weaker)
  }
  if (counts[0] === 2) {
    // One pair
    if (holeRankHits > 0) {
      const pairedRank = holeCards.find((hc) =>
        communityCards.some((cc) => cc.rank === hc.rank),
      );
      const pairValue = pairedRank ? RANK_VALUES[pairedRank.rank] : 8;
      const kicker = Math.max(
        RANK_VALUES[holeCards[0].rank],
        RANK_VALUES[holeCards[1].rank],
      );
      const kickerBonus = (kicker / 14) * 0.04;

      if (pairValue === highestBoardRank) {
        // Top pair: 0.42 - 0.52 based on kicker
        return 0.42 + (kicker / 14) * 0.10;
      }
      if (pairValue === (boardRanks[1] ?? 0)) {
        // Second pair: 0.32 - 0.38
        return 0.32 + kickerBonus + (pairValue / 14) * 0.02;
      }
      // Bottom pair or underpair to board: 0.22 - 0.30
      return 0.22 + (pairValue / 14) * 0.08;
    }
    // Pocket overpair (hole pair higher than all board cards)
    if (holeCards[0].rank === holeCards[1].rank) {
      const pairValue = RANK_VALUES[holeCards[0].rank];
      if (pairValue > highestBoardRank) {
        // Overpair: 0.55 - 0.65 based on pair rank
        return 0.55 + (pairValue / 14) * 0.10;
      }
      // Underpair to board
      return 0.25 + (pairValue / 14) * 0.10;
    }
    // Board pair only
    return 0.18;
  }

  // High card - value depends on our highest card and overcards
  const holeValues = holeCards.map((hc) => RANK_VALUES[hc.rank]).sort((a, b) => b - a);
  const overcards = holeValues.filter((v) => v > highestBoardRank).length;
  const baseHighCard = 0.05 + (holeValues[0] / 14) * 0.10;
  return baseHighCard + overcards * 0.04;
}

function checkStraight(sortedRanks: number[]): boolean {
  // Add ace-low (1) if ace is present
  const ranks = [...sortedRanks];
  if (ranks.includes(14)) ranks.unshift(1);

  let consecutive = 1;
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] === ranks[i - 1] + 1) {
      consecutive++;
      if (consecutive >= 5) return true;
    } else if (ranks[i] !== ranks[i - 1]) {
      consecutive = 1;
    }
  }
  return false;
}

/**
 * Count outs for common draws (flush draw, straight draw, overcards).
 * Handles overlap between flush and straight draws.
 */
export function countOuts(
  holeCards: Card[],
  communityCards: Card[],
): number {
  if (communityCards.length === 0 || communityCards.length >= 5) return 0;

  const allCards = [...holeCards, ...communityCards];
  let flushOuts = 0;
  let straightOuts = 0;
  let hasFlushDraw = false;

  // Flush draw: 4 cards of the same suit = 9 outs
  const suitCounts = new Map<string, number>();
  for (const c of allCards) {
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  }
  for (const count of suitCounts.values()) {
    if (count === 4) {
      flushOuts = 9;
      hasFlushDraw = true;
    }
  }

  // Open-ended straight draw: 8 outs
  // Gutshot straight draw: 4 outs
  const uniqueRanks = [...new Set(allCards.map((c) => RANK_VALUES[c.rank]))].sort(
    (a, b) => a - b,
  );
  // Add ace-low
  if (uniqueRanks.includes(14)) {
    uniqueRanks.unshift(1);
  }

  // Check for 4-card sequences with gaps
  for (let i = 0; i <= uniqueRanks.length - 3; i++) {
    const window5 = uniqueRanks.filter(
      (r) => r >= uniqueRanks[i] && r <= uniqueRanks[i] + 4,
    );
    if (window5.length === 4) {
      const missing = [];
      for (let r = uniqueRanks[i]; r <= uniqueRanks[i] + 4; r++) {
        if (!window5.includes(r)) missing.push(r);
      }
      if (missing.length === 1) {
        if (missing[0] === uniqueRanks[i] || missing[0] === uniqueRanks[i] + 4) {
          straightOuts = Math.max(straightOuts, 8); // OESD
        } else {
          straightOuts = Math.max(straightOuts, 4); // Gutshot
        }
      }
    }
  }

  // Handle overlap: with both flush and straight draw, some straight outs
  // may also complete the flush. Approximate: subtract ~2 overlap cards.
  let totalOuts: number;
  if (hasFlushDraw && straightOuts > 0) {
    // Combo draw: flush(9) + straight(8 or 4) - overlap(~2)
    totalOuts = flushOuts + straightOuts - 2;
  } else {
    totalOuts = flushOuts + straightOuts;
  }

  // Overcard outs: if we have no pair and hold cards above the board
  const boardRanks = communityCards.map((c) => RANK_VALUES[c.rank]);
  const highestBoard = Math.max(...boardRanks);
  const holeHitsBoard = holeCards.some((hc) =>
    communityCards.some((cc) => cc.rank === hc.rank),
  );

  if (!holeHitsBoard && totalOuts < 8) {
    // Count overcards (each overcard has ~3 outs to make top pair)
    const overcards = holeCards.filter(
      (hc) => RANK_VALUES[hc.rank] > highestBoard,
    ).length;
    if (overcards > 0) {
      totalOuts += overcards * 3;
    }
  }

  return totalOuts;
}

/**
 * Calculate pot odds as a ratio: amount to call / (pot + amount to call).
 */
export function getPotOdds(callAmount: number, potSize: number): number {
  if (callAmount <= 0) return 0;
  return callAmount / (potSize + callAmount);
}

/**
 * Premium starting hand tiers for AI decision making.
 */
export type HandTier = 'premium' | 'strong' | 'playable' | 'marginal' | 'trash';

export function getStartingHandTier(holeCards: Card[]): HandTier {
  const [a, b] = holeCards;
  const high = Math.max(RANK_VALUES[a.rank], RANK_VALUES[b.rank]);
  const low = Math.min(RANK_VALUES[a.rank], RANK_VALUES[b.rank]);
  const paired = a.rank === b.rank;
  const suited = a.suit === b.suit;
  const gap = high - low;

  // Premium: AA, KK, QQ, AKs
  if (paired && high >= 12) return 'premium'; // QQ+
  if (high === 14 && low === 13 && suited) return 'premium'; // AKs

  // Strong: JJ, TT, AKo, AQs, AJs, KQs
  if (paired && high >= 10) return 'strong'; // JJ, TT
  if (high === 14 && low === 13) return 'strong'; // AKo
  if (high === 14 && low === 12 && suited) return 'strong'; // AQs
  if (high === 14 && low === 11 && suited) return 'strong'; // AJs
  if (high === 13 && low === 12 && suited) return 'strong'; // KQs

  // Playable: 99-77, AQo, AJo, ATs-A8s, KQo, KJs, QJs, JTs, suited connectors 8+
  if (paired && high >= 7) return 'playable';
  if (high === 14 && low === 12) return 'playable'; // AQo
  if (high === 14 && low >= 8 && suited) return 'playable'; // A8s+
  if (high === 14 && low === 11) return 'playable'; // AJo
  if (high === 13 && low >= 11) return 'playable'; // KQ, KJ
  if (high === 12 && low === 11 && suited) return 'playable'; // QJs
  if (suited && gap === 1 && low >= 7) return 'playable'; // Suited connectors 8+

  // Marginal: 66-22, suited aces, suited connectors 5+, suited one-gappers 7+, broadway cards
  if (paired) return 'marginal'; // Low pairs
  if (high === 14 && suited) return 'marginal'; // Any suited ace
  if (suited && gap === 1 && low >= 5) return 'marginal'; // Suited connectors 56s+
  if (suited && gap === 2 && low >= 7) return 'marginal'; // Suited one-gappers 79s+
  if (high >= 11 && low >= 10) return 'marginal'; // Broadway cards (JTo, QTo)

  return 'trash';
}

/**
 * Effective stack in big blinds for the active player.
 */
export function getEffectiveStackBB(chips: number, bigBlind: number): number {
  return chips / (bigBlind || 1);
}

export { RANK_VALUES };
