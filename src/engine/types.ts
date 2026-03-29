export enum Suit {
  Hearts = 'h',
  Diamonds = 'd',
  Clubs = 'c',
  Spades = 's',
}

export enum Rank {
  Two = '2',
  Three = '3',
  Four = '4',
  Five = '5',
  Six = '6',
  Seven = '7',
  Eight = '8',
  Nine = '9',
  Ten = 'T',
  Jack = 'J',
  Queen = 'Q',
  King = 'K',
  Ace = 'A',
}

export interface Card {
  rank: Rank;
  suit: Suit;
}

export enum PokerVariant {
  TexasHoldem = 'texas-holdem',
  Omaha = 'omaha',
  Razz = 'razz',
  TripleDraw27 = '2-7-triple-draw',
  FiveCardDraw = '5-card-draw',
}

export enum Phase {
  Idle = 'idle',
  Blinds = 'blinds',
  Deal = 'deal',
  PreFlop = 'preflop',
  Flop = 'flop',
  Turn = 'turn',
  River = 'river',
  Showdown = 'showdown',
  Settle = 'settle',
  Draw1 = 'draw1',
  Draw2 = 'draw2',
  Draw3 = 'draw3',
}

export enum ActionType {
  Fold = 'fold',
  Check = 'check',
  Call = 'call',
  Raise = 'raise',
  AllIn = 'allin',
  Draw = 'draw',
}

export interface PlayerAction {
  type: ActionType;
  amount: number;
  discardIndices?: number[]; // card indices to discard in draw games
}

export interface Player {
  id: string;
  name: string;
  chips: number;
  holeCards: Card[] | null;
  isHuman: boolean;
  isFolded: boolean;
  isAllIn: boolean;
  currentBet: number;
  totalBet: number; // cumulative bet across all rounds in this hand
  seatIndex: number;
  hasActed: boolean;
  lastAction?: ActionType;
}

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface GameConfig {
  playerCount: number;
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  aiDifficulty: 'easy' | 'medium' | 'hard';
  variant: PokerVariant;
}

export interface GameState {
  phase: Phase;
  players: Player[];
  communityCards: Card[];
  deck: Card[];
  pot: number;
  sidePots: SidePot[];
  dealerIndex: number;
  activePlayerIndex: number;
  currentBet: number;
  minRaise: number;
  handNumber: number;
  config: GameConfig;
  winners: { playerId: string; amount: number; handName: string }[];
  drawRound: number; // 0 = no draw yet, 1-3 for triple draw
  allInRunout?: boolean; // true when all players are all-in, UI auto-advances phases
}
