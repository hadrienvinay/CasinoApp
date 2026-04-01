import {
  GameState,
  GameConfig,
  Phase,
  Player,
  PlayerAction,
  Card,
  ActionType,
  PokerVariant,
} from './types';
import { createDeck, shuffle, deal } from './deck';
import { compareHandsForVariant } from './hand-evaluator';
import { calculateSidePots, distributePots } from './pot';
import {
  applyAction,
  isBettingRoundOver,
  getNextActivePlayerIndex,
  countActivePlayers,
} from './betting';
import { AI_NAMES } from './constants';
import { getVariantRules } from './variant-rules';

export function createInitialState(config: GameConfig): GameState {
  const players: Player[] = [];

  // Default variant to TexasHoldem if not specified
  const safeConfig: GameConfig = {
    ...config,
    variant: config.variant ?? PokerVariant.TexasHoldem,
  };

  // Human player at seat 0
  players.push({
    id: 'human',
    name: 'You',
    chips: safeConfig.startingChips,
    holeCards: null,
    isHuman: true,
    isFolded: false,
    isAllIn: false,
    currentBet: 0,
    totalBet: 0,
    seatIndex: 0,
    hasActed: false,
  });

  for (let i = 1; i < safeConfig.playerCount; i++) {
    players.push({
      id: `ai-${i}`,
      name: AI_NAMES[i - 1],
      chips: safeConfig.startingChips,
      holeCards: null,
      isHuman: false,
      isFolded: false,
      isAllIn: false,
      currentBet: 0,
      totalBet: 0,
      seatIndex: i,
      hasActed: false,
    });
  }

  return {
    phase: Phase.Idle,
    players,
    communityCards: [],
    deck: [],
    pot: 0,
    sidePots: [],
    dealerIndex: 0,
    activePlayerIndex: 0,
    currentBet: 0,
    minRaise: safeConfig.bigBlind,
    handNumber: 0,
    config: safeConfig,
    winners: [],
    drawRound: 0,
  };
}

export function startHand(state: GameState): GameState {
  const s = JSON.parse(JSON.stringify(state)) as GameState;
  s.handNumber++;
  s.phase = Phase.Blinds;
  s.communityCards = [];
  s.pot = 0;
  s.sidePots = [];
  s.currentBet = 0;
  s.minRaise = s.config.bigBlind;
  s.winners = [];
  s.drawRound = 0;
  s.allInRunout = false;

  // Default variant if not set
  if (!s.config.variant) {
    s.config.variant = PokerVariant.TexasHoldem;
  }

  // Reset players
  s.players.forEach((p) => {
    p.holeCards = null;
    p.isFolded = false;
    p.isAllIn = false;
    p.currentBet = 0;
    p.totalBet = 0;
    p.hasActed = false;
    p.lastAction = undefined;
  });

  // Track current dealer before removing busted players
  const prevDealerId = s.players[s.dealerIndex % s.players.length]?.id;

  // Remove busted players (including human)
  s.players = s.players.filter((p) => p.chips > 0);

  if (s.players.length < 2) return s;

  // Rotate dealer — find previous dealer's new index (or next seat if they busted)
  if (s.handNumber > 1) {
    const prevIdx = s.players.findIndex((p) => p.id === prevDealerId);
    if (prevIdx !== -1) {
      // Previous dealer still in game — rotate to next
      s.dealerIndex = (prevIdx + 1) % s.players.length;
    } else {
      // Previous dealer busted — dealer index stays at same position (wraps)
      s.dealerIndex = s.dealerIndex % s.players.length;
    }
  } else {
    s.dealerIndex = s.dealerIndex % s.players.length;
  }

  // Shuffle deck
  s.deck = shuffle(createDeck());

  // Post blinds
  return postBlinds(s);
}

function postBlinds(state: GameState): GameState {
  const s = state;
  const count = s.players.length;
  const sbIndex = count === 2
    ? s.dealerIndex
    : (s.dealerIndex + 1) % count;
  const bbIndex = count === 2
    ? (s.dealerIndex + 1) % count
    : (s.dealerIndex + 2) % count;

  // Small blind
  const sb = s.players[sbIndex];
  const sbAmount = Math.min(s.config.smallBlind, sb.chips);
  sb.chips -= sbAmount;
  sb.currentBet = sbAmount;
  sb.totalBet += sbAmount;
  s.pot += sbAmount;
  if (sb.chips === 0) sb.isAllIn = true;

  // Big blind
  const bb = s.players[bbIndex];
  const bbAmount = Math.min(s.config.bigBlind, bb.chips);
  bb.chips -= bbAmount;
  bb.currentBet = bbAmount;
  bb.totalBet += bbAmount;
  s.pot += bbAmount;
  if (bb.chips === 0) bb.isAllIn = true;

  s.currentBet = bbAmount;

  // Deal hole cards based on variant
  const variant = s.config.variant ?? PokerVariant.TexasHoldem;
  const rules = getVariantRules(variant);

  s.phase = Phase.Deal;
  for (const player of s.players) {
    if (!player.isFolded) {
      const { dealt, remaining } = deal(s.deck, rules.initialDealCount);
      player.holeCards = dealt;
      s.deck = remaining;
    }
  }

  // Move to pre-flop betting
  s.phase = Phase.PreFlop;

  // UTG is after big blind
  const utgIndex = (bbIndex + 1) % count;
  s.activePlayerIndex = findNextActive(s, utgIndex);

  return s;
}

export function advance(state: GameState, action: PlayerAction): GameState {
  // Handle draw actions
  if (action.type === ActionType.Draw) {
    return handleDrawAction(state, action);
  }

  // Check if we're in a valid betting phase
  const bettingPhases = [Phase.PreFlop, Phase.Flop, Phase.Turn, Phase.River];
  if (!bettingPhases.includes(state.phase)) {
    return state;
  }

  const s = applyAction(state, state.activePlayerIndex, action);

  // Check if only one player left
  if (countActivePlayers(s) === 1) {
    return resolveWinner(s);
  }

  // Check if betting round is over
  if (isBettingRoundOver(s)) {
    return advancePhase(s);
  }

  // Move to next player
  const nextIdx = getNextActivePlayerIndex(s, s.activePlayerIndex);
  if (nextIdx === -1) {
    return advancePhase(s);
  }
  s.activePlayerIndex = nextIdx;

  return s;
}

function handleDrawAction(state: GameState, action: PlayerAction): GameState {
  const s = JSON.parse(JSON.stringify(state)) as GameState;
  const player = s.players[s.activePlayerIndex];
  const discardIndices = action.discardIndices ?? [];

  if (player.holeCards && discardIndices.length > 0) {
    // Sort indices in descending order to safely remove
    const sortedIndices = [...discardIndices].sort((a, b) => b - a);

    // Remove discarded cards
    for (const idx of sortedIndices) {
      if (idx >= 0 && idx < player.holeCards.length) {
        player.holeCards.splice(idx, 1);
      }
    }

    // Deal replacement cards
    const needed = discardIndices.length;
    const { dealt, remaining } = deal(s.deck, needed);
    player.holeCards.push(...dealt);
    s.deck = remaining;
  }

  player.hasActed = true;

  // Check if all non-folded players have drawn
  const activePlayers = s.players.filter((p) => !p.isFolded && !p.isAllIn);
  const allDrawn = activePlayers.every((p) => p.hasActed);

  if (allDrawn) {
    // Move to next betting round
    return advanceFromDraw(s);
  }

  // Move to next player for draw
  const nextIdx = getNextActivePlayerIndex(s, s.activePlayerIndex);
  if (nextIdx === -1) {
    return advanceFromDraw(s);
  }
  s.activePlayerIndex = nextIdx;

  return s;
}

function advanceFromDraw(state: GameState): GameState {
  const s = JSON.parse(JSON.stringify(state)) as GameState;
  const variant = s.config.variant ?? PokerVariant.TexasHoldem;
  const rules = getVariantRules(variant);

  // Reset for next betting round
  s.players.forEach((p) => {
    p.currentBet = 0;
    p.hasActed = false;
  });
  s.currentBet = 0;
  s.minRaise = s.config.bigBlind;

  // Find current position in phase sequence
  const currentPhaseIdx = rules.phaseSequence.indexOf(s.phase);
  const nextPhaseIdx = currentPhaseIdx + 1;

  if (nextPhaseIdx >= rules.phaseSequence.length) {
    return resolveShowdown(s);
  }

  s.phase = rules.phaseSequence[nextPhaseIdx];

  // Set first active player
  const startIdx = (s.dealerIndex + 1) % s.players.length;
  s.activePlayerIndex = findNextActive(s, startIdx);

  return s;
}

function advancePhase(state: GameState): GameState {
  const s = JSON.parse(JSON.stringify(state)) as GameState;
  const variant = s.config.variant ?? PokerVariant.TexasHoldem;
  const rules = getVariantRules(variant);

  // Reset for next betting round
  s.players.forEach((p) => {
    p.currentBet = 0;
    p.hasActed = false;
  });
  s.currentBet = 0;
  s.minRaise = s.config.bigBlind;

  // For community card games (Hold'em, Omaha), use the standard flow
  if (rules.hasCommunityCards) {
    return advanceCommunityCardPhase(s);
  }

  // For non-community card games, use the phase sequence
  return advanceNonCommunityPhase(s, variant, rules);
}

function advanceCommunityCardPhase(state: GameState): GameState {
  const s = state;

  switch (s.phase) {
    case Phase.PreFlop: {
      // Deal flop
      const { dealt, remaining } = deal(s.deck, 3);
      s.communityCards = dealt;
      s.deck = remaining;
      s.phase = Phase.Flop;
      break;
    }
    case Phase.Flop: {
      const { dealt, remaining } = deal(s.deck, 1);
      s.communityCards.push(dealt[0]);
      s.deck = remaining;
      s.phase = Phase.Turn;
      break;
    }
    case Phase.Turn: {
      const { dealt, remaining } = deal(s.deck, 1);
      s.communityCards.push(dealt[0]);
      s.deck = remaining;
      s.phase = Phase.River;
      break;
    }
    case Phase.River: {
      return resolveShowdown(s);
    }
  }

  // Check if all remaining players are all-in (no more betting possible)
  const canAct = s.players.filter((p) => !p.isFolded && !p.isAllIn);
  if (canAct.length <= 1) {
    // Mark state so the UI knows to auto-advance phases with pauses
    s.allInRunout = true;
    return s;
  }

  // First active player after dealer
  const startIdx = (s.dealerIndex + 1) % s.players.length;
  s.activePlayerIndex = findNextActive(s, startIdx);

  return s;
}

function advanceNonCommunityPhase(
  state: GameState,
  variant: PokerVariant,
  rules: ReturnType<typeof getVariantRules>,
): GameState {
  const s = state;
  const currentPhaseIdx = rules.phaseSequence.indexOf(s.phase);

  // If we can't find the phase or we're at the end, go to showdown
  if (currentPhaseIdx === -1 || currentPhaseIdx >= rules.phaseSequence.length - 1) {
    return resolveShowdown(s);
  }

  const nextPhase = rules.phaseSequence[currentPhaseIdx + 1];

  // Handle Razz: deal additional cards on Turn phase
  if (variant === PokerVariant.Razz && s.phase === Phase.PreFlop) {
    // Deal 2 more cards to each active player
    for (const player of s.players) {
      if (!player.isFolded && player.holeCards) {
        const { dealt, remaining } = deal(s.deck, 2);
        player.holeCards.push(...dealt);
        s.deck = remaining;
      }
    }
  }

  s.phase = nextPhase;

  // If next phase is a draw phase, set up for drawing
  if (nextPhase === Phase.Draw1 || nextPhase === Phase.Draw2 || nextPhase === Phase.Draw3) {
    s.drawRound++;
    // Reset hasActed for draw round
    s.players.forEach((p) => {
      p.hasActed = false;
    });
    const startIdx = (s.dealerIndex + 1) % s.players.length;
    s.activePlayerIndex = findNextActive(s, startIdx);
    return s;
  }

  // Check if all remaining players are all-in
  const canAct = s.players.filter((p) => !p.isFolded && !p.isAllIn);
  if (canAct.length <= 1) {
    return resolveShowdown(s);
  }

  // First active player after dealer
  const startIdx = (s.dealerIndex + 1) % s.players.length;
  s.activePlayerIndex = findNextActive(s, startIdx);

  return s;
}

/**
 * Advance one phase during an all-in runout (no betting).
 * Returns the new state after dealing the next community card(s).
 */
export function advanceRunout(state: GameState): GameState {
  const s = JSON.parse(JSON.stringify(state)) as GameState;

  // Reset per-phase state
  s.players.forEach((p) => {
    p.currentBet = 0;
    p.hasActed = false;
  });
  s.currentBet = 0;

  switch (s.phase) {
    case Phase.PreFlop: {
      const { dealt, remaining } = deal(s.deck, 3);
      s.communityCards = dealt;
      s.deck = remaining;
      s.phase = Phase.Flop;
      break;
    }
    case Phase.Flop: {
      const { dealt, remaining } = deal(s.deck, 1);
      s.communityCards.push(dealt[0]);
      s.deck = remaining;
      s.phase = Phase.Turn;
      break;
    }
    case Phase.Turn: {
      const { dealt, remaining } = deal(s.deck, 1);
      s.communityCards.push(dealt[0]);
      s.deck = remaining;
      s.phase = Phase.River;
      break;
    }
    case Phase.River: {
      s.allInRunout = false;
      return resolveShowdown(s);
    }
  }

  return s;
}

function resolveShowdown(state: GameState): GameState {
  const s = JSON.parse(JSON.stringify(state)) as GameState;
  s.phase = Phase.Showdown;

  const variant = s.config.variant ?? PokerVariant.TexasHoldem;
  const activePlayers = s.players.filter((p) => !p.isFolded && p.holeCards);

  // Calculate side pots
  s.sidePots = calculateSidePots(s.players);

  // If no side pots (simple case), create one main pot
  if (s.sidePots.length === 0) {
    s.sidePots = [{
      amount: s.pot,
      eligiblePlayerIds: activePlayers.map((p) => p.id),
    }];
  }

  // Determine winners for each pot
  const winnersByPot = new Map<number, string[]>();

  s.sidePots.forEach((pot, index) => {
    const eligible = activePlayers.filter((p) =>
      pot.eligiblePlayerIds.includes(p.id),
    );

    if (eligible.length === 0) return;

    const winners = compareHandsForVariant(
      eligible.map((p) => ({
        playerId: p.id,
        holeCards: p.holeCards as Card[],
      })),
      s.communityCards,
      variant,
    );

    winnersByPot.set(
      index,
      winners.map((w) => w.playerId),
    );

    // Store hand name for display
    winners.forEach((w) => {
      if (!s.winners.find((existing) => existing.playerId === w.playerId)) {
        s.winners.push({
          playerId: w.playerId,
          amount: 0,
          handName: w.handName,
        });
      }
    });
  });

  // Distribute
  const winnings = distributePots(s.sidePots, winnersByPot);

  winnings.forEach((amount, playerId) => {
    const player = s.players.find((p) => p.id === playerId);
    if (player) player.chips += amount;

    const winner = s.winners.find((w) => w.playerId === playerId);
    if (winner) winner.amount = amount;
  });

  s.phase = Phase.Settle;
  return s;
}

function resolveWinner(state: GameState): GameState {
  const s = JSON.parse(JSON.stringify(state)) as GameState;
  const winner = s.players.find((p) => !p.isFolded)!;

  winner.chips += s.pot;
  s.winners = [{
    playerId: winner.id,
    amount: s.pot,
    handName: 'Everyone folded',
  }];

  s.phase = Phase.Settle;
  return s;
}

function findNextActive(state: GameState, startIndex: number): number {
  const count = state.players.length;
  let idx = startIndex;
  for (let i = 0; i < count; i++) {
    const p = state.players[idx % count];
    if (!p.isFolded && !p.isAllIn) return idx % count;
    idx++;
  }
  return startIndex;
}

/**
 * Check if the current phase is a draw phase.
 */
export function isDrawPhase(phase: Phase): boolean {
  return phase === Phase.Draw1 || phase === Phase.Draw2 || phase === Phase.Draw3;
}
