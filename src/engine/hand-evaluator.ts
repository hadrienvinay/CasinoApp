import { Hand } from 'pokersolver';
import { Card, PokerVariant, Rank } from './types';
import { cardToString } from './deck';

export interface HandResult {
  name: string;
  rank: number;
  cards: string[];
}

function toPokersolverFormat(card: Card): string {
  const str = cardToString(card);
  const rank = str[0];
  const suit = str[1];
  return `${rank}${suit}`;
}

export function evaluateHand(holeCards: Card[], communityCards: Card[]): HandResult {
  const allCards = [...holeCards, ...communityCards].map(toPokersolverFormat);
  const hand = Hand.solve(allCards);
  return {
    name: hand.name,
    rank: hand.rank,
    cards: hand.cards.map((c: { toString: () => string }) => c.toString()),
  };
}

export function compareHands(
  hands: { playerId: string; holeCards: Card[] }[],
  communityCards: Card[],
): { playerId: string; handName: string }[] {
  const solved = hands.map((h) => ({
    playerId: h.playerId,
    hand: Hand.solve(
      [...h.holeCards, ...communityCards].map(toPokersolverFormat),
    ),
  }));

  const handObjects = solved.map((s) => s.hand);
  const winnerHands = Hand.winners(handObjects);

  return solved
    .filter((s) => winnerHands.includes(s.hand))
    .map((s) => ({
      playerId: s.playerId,
      handName: s.hand.name,
    }));
}

// --- Omaha evaluation ---

/**
 * Omaha: must use exactly 2 from hole + 3 from community.
 * Enumerate all C(4,2) * C(5,3) = 60 combinations and pick best.
 */
export function evaluateOmahaHand(holeCards: Card[], communityCards: Card[]): HandResult {
  let bestResult: HandResult | null = null;

  const holeCombos = combinations(holeCards, 2);
  const communityCombos = combinations(communityCards, 3);

  for (const holeCombo of holeCombos) {
    for (const communityCombo of communityCombos) {
      const fiveCards = [...holeCombo, ...communityCombo].map(toPokersolverFormat);
      const hand = Hand.solve(fiveCards);
      const result: HandResult = {
        name: hand.name,
        rank: hand.rank,
        cards: hand.cards.map((c: { toString: () => string }) => c.toString()),
      };

      if (!bestResult || result.rank > bestResult.rank) {
        bestResult = result;
      } else if (result.rank === bestResult.rank) {
        // Same rank category, compare within category using pokersolver
        const hands = [
          Hand.solve([...holeCombo, ...communityCombo].map(toPokersolverFormat)),
          Hand.solve(bestResult.cards),
        ];
        const winners = Hand.winners(hands);
        if (winners.includes(hands[0]) && !winners.includes(hands[1])) {
          bestResult = result;
        }
      }
    }
  }

  return bestResult ?? { name: 'High Card', rank: 0, cards: [] };
}

// --- Razz (Ace-to-Five lowball) evaluation ---

const RAZZ_RANK_VALUES: Record<string, number> = {
  [Rank.Ace]: 1,
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
};

/**
 * Razz: ace-to-five lowball.
 * - Aces are low (value 1)
 * - Straights and flushes do NOT count against you
 * - Best hand is A-2-3-4-5
 * - Lower is better
 * Pick the best 5-card low hand from available cards.
 */
export function evaluateRazzHand(cards: Card[]): HandResult {
  const fiveCardCombos = combinations(cards, 5);
  let bestScore: number[] | null = null;
  let bestCombo: Card[] | null = null;

  for (const combo of fiveCardCombos) {
    const values = combo.map((c) => RAZZ_RANK_VALUES[c.rank]);
    // Remove duplicates for ranking purposes (pairs are bad in lowball)
    const uniqueValues = [...new Set(values)];
    if (uniqueValues.length < 5) {
      // Has pairs - this is a worse hand. Score it very high.
      const sorted = values.sort((a, b) => b - a);
      const score = [100, ...sorted]; // prefix with 100 to make it worse than any unpaired hand
      if (!bestScore || compareLowScores(score, bestScore) < 0) {
        bestScore = score;
        bestCombo = combo;
      }
      continue;
    }

    // Sort descending for lexicographic comparison (lower is better)
    const sorted = values.sort((a, b) => b - a);

    if (!bestScore || compareLowScores(sorted, bestScore) < 0) {
      bestScore = sorted;
      bestCombo = combo;
    }
  }

  if (!bestCombo || !bestScore) {
    return { name: 'No hand', rank: 0, cards: [] };
  }

  const handName = describeLowHand(bestScore, 'razz');
  // For lowball, rank is inverted: lower score = higher rank
  // Use a large number minus the score to create a comparable rank
  const numericScore = bestScore.reduce((acc, v, i) => acc + v * Math.pow(100, 4 - i), 0);
  const rank = 1000000000 - numericScore;

  return {
    name: handName,
    rank,
    cards: bestCombo.map((c) => cardToString(c)),
  };
}

// --- 2-7 Triple Draw (Deuce-to-Seven lowball) evaluation ---

const RANK_VALUES_27: Record<string, number> = {
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
 * 2-7 Triple Draw: deuce-to-seven lowball.
 * - Aces are HIGH (value 14)
 * - Straights and flushes COUNT (are bad)
 * - Best possible hand is 2-3-4-5-7 unsuited
 * - Lower is better
 */
export function evaluate27LowHand(cards: Card[]): HandResult {
  const fiveCardCombos = combinations(cards, 5);
  let bestScore: number[] | null = null;
  let bestCombo: Card[] | null = null;

  for (const combo of fiveCardCombos) {
    const values = combo.map((c) => RANK_VALUES_27[c.rank]);
    const uniqueValues = [...new Set(values)];

    // Check for pairs (bad)
    if (uniqueValues.length < 5) {
      const sorted = values.sort((a, b) => b - a);
      const score = [200, ...sorted]; // pairs are worse than straights/flushes
      if (!bestScore || compareLowScores(score, bestScore) < 0) {
        bestScore = score;
        bestCombo = combo;
      }
      continue;
    }

    const sorted = values.sort((a, b) => b - a);

    // Check for flush (all same suit - bad)
    const isFlush = combo.every((c) => c.suit === combo[0].suit);

    // Check for straight (bad)
    const isStraight = checkIsStraight27(values);

    let score: number[];
    if (isFlush && isStraight) {
      score = [150, ...sorted]; // straight flush is very bad
    } else if (isFlush) {
      score = [130, ...sorted]; // flush is bad
    } else if (isStraight) {
      score = [120, ...sorted]; // straight is bad
    } else {
      score = sorted;
    }

    if (!bestScore || compareLowScores(score, bestScore) < 0) {
      bestScore = score;
      bestCombo = combo;
    }
  }

  if (!bestCombo || !bestScore) {
    return { name: 'No hand', rank: 0, cards: [] };
  }

  const handName = describeLowHand(bestScore, '27');
  const numericScore = bestScore.reduce((acc, v, i) => acc + v * Math.pow(100, 4 - i), 0);
  const rank = 1000000000 - numericScore;

  return {
    name: handName,
    rank,
    cards: bestCombo.map((c) => cardToString(c)),
  };
}

/**
 * Check if sorted values form a straight in 2-7 lowball.
 * Ace is always high (14), no ace-low straights.
 */
function checkIsStraight27(values: number[]): boolean {
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

/** Compare two low hand scores. Returns negative if a is better (lower). */
function compareLowScores(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function describeLowHand(score: number[], type: 'razz' | '27'): string {
  // If score starts with a penalty prefix, describe accordingly
  if (score[0] >= 100) {
    if (score[0] >= 200) return 'Pair (bad for low)';
    if (score[0] >= 150) return 'Straight Flush (bad for low)';
    if (score[0] >= 130) return 'Flush (bad for low)';
    if (score[0] >= 120) return 'Straight (bad for low)';
    return 'Pair (bad for low)';
  }

  const rankNames: Record<number, string> = {
    1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
    8: '8', 9: '9', 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
  };

  // score is sorted descending
  const cardNames = score.map((v) => rankNames[v] ?? '?');
  const highCard = cardNames[0];

  if (type === 'razz') {
    return `${highCard}-low (${cardNames.join('-')})`;
  }
  return `${highCard}-low (${cardNames.join('-')})`;
}

// --- Variant-aware comparison ---

/**
 * Compare hands for a specific variant, returning winners.
 */
export function compareHandsForVariant(
  hands: { playerId: string; holeCards: Card[] }[],
  communityCards: Card[],
  variant: PokerVariant,
): { playerId: string; handName: string }[] {
  switch (variant) {
    case PokerVariant.Omaha:
      return compareOmahaHands(hands, communityCards);

    case PokerVariant.Razz:
      return compareLowballHands(hands, 'razz');

    case PokerVariant.TripleDraw27:
      return compareLowballHands(hands, '27');

    case PokerVariant.FiveCardDraw:
      return compareFiveCardDrawHands(hands);

    case PokerVariant.TexasHoldem:
    default:
      return compareHands(hands, communityCards);
  }
}

function compareOmahaHands(
  hands: { playerId: string; holeCards: Card[] }[],
  communityCards: Card[],
): { playerId: string; handName: string }[] {
  const evaluated = hands.map((h) => ({
    playerId: h.playerId,
    result: evaluateOmahaHand(h.holeCards, communityCards),
  }));

  const maxRank = Math.max(...evaluated.map((e) => e.result.rank));

  return evaluated
    .filter((e) => e.result.rank === maxRank)
    .map((e) => ({
      playerId: e.playerId,
      handName: e.result.name,
    }));
}

function compareLowballHands(
  hands: { playerId: string; holeCards: Card[] }[],
  type: 'razz' | '27',
): { playerId: string; handName: string }[] {
  const evalFn = type === 'razz' ? evaluateRazzHand : evaluate27LowHand;

  const evaluated = hands.map((h) => ({
    playerId: h.playerId,
    result: evalFn(h.holeCards),
  }));

  // Higher rank = better in our lowball scoring (rank = 1B - score)
  const maxRank = Math.max(...evaluated.map((e) => e.result.rank));

  return evaluated
    .filter((e) => e.result.rank === maxRank)
    .map((e) => ({
      playerId: e.playerId,
      handName: e.result.name,
    }));
}

export function evaluateFiveCardDrawHand(holeCards: Card[]): HandResult {
  const solved = Hand.solve(holeCards.map(toPokersolverFormat));
  return {
    name: solved.name,
    rank: solved.rank,
    cards: solved.cards.map((c: { toString: () => string }) => c.toString()),
  };
}

function compareFiveCardDrawHands(
  hands: { playerId: string; holeCards: Card[] }[],
): { playerId: string; handName: string }[] {
  // For 5-card draw, evaluate each hand's 5 cards using standard poker rankings
  const solved = hands.map((h) => ({
    playerId: h.playerId,
    hand: Hand.solve(h.holeCards.map(toPokersolverFormat)),
  }));

  const handObjects = solved.map((s) => s.hand);
  const winnerHands = Hand.winners(handObjects);

  return solved
    .filter((s) => winnerHands.includes(s.hand))
    .map((s) => ({
      playerId: s.playerId,
      handName: s.hand.name,
    }));
}

// --- Utility: generate combinations ---

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];

  const result: T[][] = [];

  function helper(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      helper(i + 1, current);
      current.pop();
    }
  }

  helper(0, []);
  return result;
}
