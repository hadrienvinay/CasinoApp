import { Card } from '@/engine/types';
import { createDeck, shuffle, deal } from '@/engine/deck';
import { BJPhase, BJResult, BJHand, BJConfig, BJState } from './types';
import { calculateHandValue, canSplit, canDoubleDown } from './hand-value';

function createShoe(deckCount: number): Card[] {
  let shoe: Card[] = [];
  for (let i = 0; i < deckCount; i++) {
    shoe = [...shoe, ...createDeck()];
  }
  return shuffle(shoe);
}

function drawCard(state: BJState): { card: Card; deck: Card[] } {
  let deck = state.deck;
  // Reshuffle if running low
  if (deck.length < 20) {
    deck = createShoe(state.config.deckCount);
  }
  const { dealt, remaining } = deal(deck, 1);
  return { card: dealt[0], deck: remaining };
}

export function createInitialBJState(config: BJConfig): BJState {
  return {
    phase: BJPhase.Betting,
    deck: createShoe(config.deckCount),
    playerHands: [],
    activeHandIndex: 0,
    dealerCards: [],
    dealerHoleRevealed: false,
    chips: config.startingChips,
    currentBet: config.minBet,
    config,
    roundNumber: 0,
    message: 'Place your bet',
  };
}

export function placeBet(state: BJState, amount: number): BJState {
  const bet = Math.min(Math.max(amount, state.config.minBet), state.config.maxBet, state.chips);
  return {
    ...state,
    currentBet: bet,
    chips: state.chips - bet,
    phase: BJPhase.Dealing,
    message: 'Dealing...',
  };
}

/**
 * Deal a single card to player or dealer. Used by the store to deal one at a time.
 * target: 'player' or 'dealer'
 */
export function dealOneCard(state: BJState, target: 'player' | 'dealer'): BJState {
  const { card, deck } = drawCard(state);

  if (target === 'player') {
    const hands = state.playerHands.length > 0
      ? [...state.playerHands]
      : [{ cards: [] as Card[], bet: state.currentBet, isDoubled: false, isStood: false, result: null }];
    const hand = { ...hands[0], cards: [...hands[0].cards, card] };
    hands[0] = hand;
    return { ...state, deck, playerHands: hands };
  } else {
    return { ...state, deck, dealerCards: [...state.dealerCards, card] };
  }
}

/**
 * Check for blackjacks after all 4 cards are dealt. Returns the final state.
 */
export function checkBlackjacks(state: BJState): BJState {
  const playerCards = state.playerHands[0]?.cards ?? [];
  const dealerCards = state.dealerCards;

  const playerHand = state.playerHands[0];
  const playerValue = calculateHandValue(playerCards);
  const dealerValue = calculateHandValue(dealerCards);

  if (playerValue.isBlackjack && dealerValue.isBlackjack) {
    // Push — return original bet
    return {
      ...state,
      playerHands: [{ ...playerHand, result: BJResult.Push }],
      dealerHoleRevealed: true,
      chips: state.chips + playerHand.bet,
      phase: BJPhase.Settle,
      roundNumber: state.roundNumber + 1,
      message: 'Push - both Blackjack!',
    };
  }

  if (playerValue.isBlackjack) {
    // Blackjack pays 3:2
    const winnings = playerHand.bet + Math.floor(playerHand.bet * 1.5);
    return {
      ...state,
      playerHands: [{ ...playerHand, result: BJResult.PlayerBlackjack }],
      dealerHoleRevealed: true,
      chips: state.chips + winnings,
      phase: BJPhase.Settle,
      roundNumber: state.roundNumber + 1,
      message: 'Blackjack!',
    };
  }

  if (dealerValue.isBlackjack) {
    // Dealer blackjack — player loses (bet already deducted)
    return {
      ...state,
      playerHands: [{ ...playerHand, result: BJResult.DealerWin }],
      dealerHoleRevealed: true,
      phase: BJPhase.Settle,
      roundNumber: state.roundNumber + 1,
      message: 'Dealer Blackjack!',
    };
  }

  return {
    ...state,
    dealerHoleRevealed: false,
    phase: BJPhase.PlayerTurn,
    activeHandIndex: 0,
    roundNumber: state.roundNumber + 1,
    message: 'Your turn',
  };
}

/** @deprecated Use dealOneCard + checkBlackjacks instead */
export function dealInitialCards(state: BJState): BJState {
  let s = state;
  // player, dealer, player, dealer
  s = dealOneCard(s, 'player');
  s = dealOneCard(s, 'dealer');
  s = dealOneCard(s, 'player');
  s = dealOneCard(s, 'dealer');
  return checkBlackjacks(s);
}

export function playerHit(state: BJState): BJState {
  const { card, deck } = drawCard(state);
  const hands = [...state.playerHands];
  const hand = { ...hands[state.activeHandIndex] };
  hand.cards = [...hand.cards, card];
  hands[state.activeHandIndex] = hand;

  const value = calculateHandValue(hand.cards);

  if (value.isBust) {
    hand.result = BJResult.PlayerBust;
    hands[state.activeHandIndex] = hand;
    // Move to next hand or dealer turn
    return moveToNextHand({ ...state, deck, playerHands: hands });
  }

  if (value.best === 21) {
    hand.isStood = true;
    hands[state.activeHandIndex] = hand;
    return moveToNextHand({ ...state, deck, playerHands: hands });
  }

  return { ...state, deck, playerHands: hands, message: `Your hand: ${value.best}` };
}

export function playerStand(state: BJState): BJState {
  const hands = [...state.playerHands];
  const hand = { ...hands[state.activeHandIndex] };
  hand.isStood = true;
  hands[state.activeHandIndex] = hand;

  return moveToNextHand({ ...state, playerHands: hands });
}

export function playerDoubleDown(state: BJState): BJState {
  const hands = [...state.playerHands];
  const hand = { ...hands[state.activeHandIndex] };

  if (!canDoubleDown(hand) || state.chips < hand.bet) {
    return state;
  }

  const { card, deck } = drawCard(state);
  hand.cards = [...hand.cards, card];
  hand.isDoubled = true;
  hand.isStood = true;
  const additionalBet = hand.bet;
  hand.bet = hand.bet * 2;
  hands[state.activeHandIndex] = hand;

  const value = calculateHandValue(hand.cards);
  if (value.isBust) {
    hand.result = BJResult.PlayerBust;
    hands[state.activeHandIndex] = hand;
  }

  const newState = {
    ...state,
    deck,
    playerHands: hands,
    chips: state.chips - additionalBet,
  };

  return moveToNextHand(newState);
}

export function playerSplit(state: BJState): BJState {
  const hands = [...state.playerHands];
  const hand = hands[state.activeHandIndex];

  if (!canSplit(hand) || state.chips < hand.bet) {
    return state;
  }

  const { card: card1, deck: deck1 } = drawCard(state);
  const { card: card2, deck: deck2 } = drawCard({ ...state, deck: deck1 });

  const hand1: BJHand = {
    cards: [hand.cards[0], card1],
    bet: hand.bet,
    isDoubled: false,
    isStood: false,
    result: null,
  };

  const hand2: BJHand = {
    cards: [hand.cards[1], card2],
    bet: hand.bet,
    isDoubled: false,
    isStood: false,
    result: null,
  };

  const newHands = [
    ...hands.slice(0, state.activeHandIndex),
    hand1,
    hand2,
    ...hands.slice(state.activeHandIndex + 1),
  ];

  return {
    ...state,
    deck: deck2,
    playerHands: newHands,
    chips: state.chips - hand.bet,
    activeHandIndex: state.activeHandIndex,
    message: 'Hand 1',
  };
}

function moveToNextHand(state: BJState): BJState {
  // Check if there are more hands to play
  for (let i = state.activeHandIndex + 1; i < state.playerHands.length; i++) {
    const hand = state.playerHands[i];
    if (!hand.isStood && hand.result === null) {
      return {
        ...state,
        activeHandIndex: i,
        message: `Hand ${i + 1}`,
      };
    }
  }

  // All hands done — check if any hands are still standing (not busted)
  const hasActiveHand = state.playerHands.some(
    (h) => h.result === null || h.result !== BJResult.PlayerBust,
  );

  if (!hasActiveHand) {
    // All hands busted
    return settleRound(state);
  }

  return {
    ...state,
    phase: BJPhase.DealerTurn,
    message: "Dealer's turn",
  };
}

export function dealerDrawCard(state: BJState): BJState {
  const { card, deck } = drawCard(state);
  return {
    ...state,
    deck,
    dealerCards: [...state.dealerCards, card],
    dealerHoleRevealed: true,
  };
}

export function shouldDealerHit(state: BJState): boolean {
  const value = calculateHandValue(state.dealerCards);
  // Dealer hits on soft 17 and below, stands on hard 17+
  if (value.best < 17) return true;
  if (value.best === 17 && value.isSoft) return true;
  return false;
}

export function revealDealerHole(state: BJState): BJState {
  return { ...state, dealerHoleRevealed: true };
}

export function settleRound(state: BJState): BJState {
  const dealerValue = calculateHandValue(state.dealerCards);
  const hands = state.playerHands.map((hand) => {
    if (hand.result !== null) return hand; // Already settled (bust/blackjack)

    const playerValue = calculateHandValue(hand.cards);

    if (dealerValue.isBust) {
      return { ...hand, result: BJResult.DealerBust };
    }

    if (playerValue.best > dealerValue.best) {
      return { ...hand, result: BJResult.PlayerWin };
    }

    if (playerValue.best < dealerValue.best) {
      return { ...hand, result: BJResult.DealerWin };
    }

    return { ...hand, result: BJResult.Push };
  });

  // Calculate winnings
  let totalWinnings = 0;
  for (const hand of hands) {
    switch (hand.result) {
      case BJResult.PlayerBlackjack:
        totalWinnings += hand.bet + Math.floor(hand.bet * 1.5); // 3:2 payout
        break;
      case BJResult.PlayerWin:
      case BJResult.DealerBust:
        totalWinnings += hand.bet * 2;
        break;
      case BJResult.Push:
        totalWinnings += hand.bet; // return bet
        break;
      // DealerWin, PlayerBust: lose bet (already deducted)
    }
  }

  const resultMessages = hands.map((h) => {
    switch (h.result) {
      case BJResult.PlayerBlackjack: return 'Blackjack!';
      case BJResult.PlayerWin: return 'You win!';
      case BJResult.DealerBust: return 'Dealer busts!';
      case BJResult.Push: return 'Push';
      case BJResult.PlayerBust: return 'Bust';
      case BJResult.DealerWin: return 'Dealer wins';
      default: return '';
    }
  });

  const message = hands.length === 1
    ? resultMessages[0]
    : resultMessages.map((m, i) => `Hand ${i + 1}: ${m}`).join(' | ');

  return {
    ...state,
    playerHands: hands,
    dealerHoleRevealed: true,
    chips: state.chips + totalWinnings,
    phase: BJPhase.Settle,
    message,
  };
}

export function nextRound(state: BJState): BJState {
  let deck = state.deck;
  // Reshuffle if less than 25% of shoe remains
  const shoeSize = state.config.deckCount * 52;
  if (deck.length < shoeSize * 0.25) {
    deck = createShoe(state.config.deckCount);
  }

  return {
    ...state,
    deck,
    playerHands: [],
    dealerCards: [],
    dealerHoleRevealed: false,
    activeHandIndex: 0,
    phase: BJPhase.Betting,
    message: 'Place your bet',
  };
}
