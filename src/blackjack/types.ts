import { Card } from '@/engine/types';

export enum BJPhase {
  Betting = 'betting',
  Dealing = 'dealing',
  PlayerTurn = 'playerTurn',
  DealerTurn = 'dealerTurn',
  Settle = 'settle',
}

export enum BJAction {
  Hit = 'hit',
  Stand = 'stand',
  DoubleDown = 'doubleDown',
  Split = 'split',
}

export enum BJResult {
  PlayerBlackjack = 'playerBlackjack',
  PlayerWin = 'playerWin',
  DealerWin = 'dealerWin',
  Push = 'push',
  PlayerBust = 'playerBust',
  DealerBust = 'dealerBust',
}

export interface BJHand {
  cards: Card[];
  bet: number;
  isDoubled: boolean;
  isStood: boolean;
  result: BJResult | null;
}

export interface BJConfig {
  startingChips: number;
  minBet: number;
  maxBet: number;
  deckCount: number;
}

export interface BJState {
  phase: BJPhase;
  deck: Card[];
  playerHands: BJHand[];
  activeHandIndex: number;
  dealerCards: Card[];
  dealerHoleRevealed: boolean;
  chips: number;
  currentBet: number;
  config: BJConfig;
  roundNumber: number;
  message: string;
}
