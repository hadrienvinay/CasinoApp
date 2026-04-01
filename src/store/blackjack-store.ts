import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BJPhase, BJConfig, BJState } from '@/blackjack/types';
import { canSplit, canDoubleDown } from '@/blackjack/hand-value';
import {
  createInitialBJState,
  placeBet,
  dealOneCard,
  checkBlackjacks,
  playerHit,
  playerStand,
  playerDoubleDown,
  playerSplit,
  dealerDrawCard,
  shouldDealerHit,
  revealDealerHole,
  settleRound,
  nextRound,
} from '@/blackjack/game-machine';
import { playCardDeal, playChipBet, playWinChime } from '@/lib/sounds';

interface BlackjackStore {
  state: BJState | null;
  isAnimating: boolean;

  initGame: (config: BJConfig) => void;
  doBet: (amount: number) => void;
  doDeal: () => Promise<void>;
  doHit: () => Promise<void>;
  doStand: () => void;
  doDoubleDown: () => Promise<void>;
  doSplit: () => void;
  processDealerTurn: () => Promise<void>;
  startNextRound: () => void;
  setAnimating: (v: boolean) => void;
  canPlayerSplit: () => boolean;
  canPlayerDouble: () => boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const useBlackjackStore = create<BlackjackStore>()(persist((set, get) => ({
  state: null,
  isAnimating: false,

  initGame: (config: BJConfig) => {
    set({ state: createInitialBJState(config) });
  },

  doBet: (amount: number) => {
    const { state } = get();
    if (!state || state.phase !== BJPhase.Betting) return;
    playChipBet();
    set({ state: placeBet(state, amount) });
  },

  doDeal: async () => {
    const { state } = get();
    if (!state || state.phase !== BJPhase.Dealing) return;
    set({ isAnimating: true });

    // Deal all 4 cards at once into state — the canvas animation will handle
    // the per-card deal sequence visually (cards fly from deck one by one)
    let current = state;
    for (const target of (['player', 'dealer', 'player', 'dealer'] as const)) {
      current = dealOneCard(current, target);
    }
    set({ state: current });

    // Wait for deal animation to finish:
    // 4 cards × (slide 200ms + flip 300ms + pause 80ms) ≈ 2320ms, +480ms buffer
    await delay(2800);

    const finalState = checkBlackjacks(current);
    set({ state: finalState, isAnimating: false });

    // If immediate settle (blackjack), play win chime
    if (finalState.phase === BJPhase.Settle) {
      const hasWin = finalState.playerHands.some((h) =>
        h.result === 'playerBlackjack' || h.result === 'playerWin',
      );
      if (hasWin) playWinChime();
    }

    // Auto-start dealer turn if player phase was skipped
    if (finalState.phase === BJPhase.DealerTurn) {
      get().processDealerTurn();
    }
  },

  doHit: async () => {
    const { state, isAnimating } = get();
    if (!state || state.phase !== BJPhase.PlayerTurn || isAnimating) return;
    set({ isAnimating: true });
    playCardDeal();
    const newState = playerHit(state);
    set({ state: newState });

    // Pause so the player sees the card before bust/dealer turn
    await delay(700);
    set({ isAnimating: false });

    if (newState.phase === BJPhase.DealerTurn) {
      get().processDealerTurn();
    } else if (newState.phase === BJPhase.Settle) {
      playWinChime();
    }
  },

  doStand: () => {
    const { state, isAnimating } = get();
    if (!state || state.phase !== BJPhase.PlayerTurn || isAnimating) return;
    const newState = playerStand(state);
    set({ state: newState });

    if (newState.phase === BJPhase.DealerTurn) {
      get().processDealerTurn();
    }
  },

  doDoubleDown: async () => {
    const { state, isAnimating } = get();
    if (!state || state.phase !== BJPhase.PlayerTurn || isAnimating) return;
    set({ isAnimating: true });
    playChipBet();
    playCardDeal();
    const newState = playerDoubleDown(state);
    set({ state: newState });

    // Pause so the player sees the card before bust/dealer turn
    await delay(700);
    set({ isAnimating: false });

    if (newState.phase === BJPhase.DealerTurn) {
      get().processDealerTurn();
    } else if (newState.phase === BJPhase.Settle) {
      playWinChime();
    }
  },

  doSplit: () => {
    const { state, isAnimating } = get();
    if (!state || state.phase !== BJPhase.PlayerTurn || isAnimating) return;
    playChipBet();
    playCardDeal();
    const newState = playerSplit(state);
    set({ state: newState });
  },

  processDealerTurn: async () => {
    set({ isAnimating: true });

    const { state } = get();
    if (!state) { set({ isAnimating: false }); return; }

    // Reveal hole card
    await delay(600);
    set({ state: revealDealerHole(get().state!) });

    // Draw cards one by one
    while (true) {
      await delay(500);
      const current = get().state;
      if (!current) break;
      if (!shouldDealerHit(current)) break;

      playCardDeal();
      set({ state: dealerDrawCard(current) });
    }

    // Settle
    await delay(400);
    const finalState = get().state;
    if (finalState) {
      const settled = settleRound(finalState);
      set({ state: settled });

      const hasWin = settled.playerHands.some((h) =>
        h.result === 'playerBlackjack' || h.result === 'playerWin' || h.result === 'dealerBust',
      );
      if (hasWin) playWinChime();
    }

    set({ isAnimating: false });
  },

  startNextRound: () => {
    const { state } = get();
    if (!state) return;
    set({ state: nextRound(state) });
  },

  setAnimating: (v: boolean) => set({ isAnimating: v }),

  canPlayerSplit: () => {
    const { state } = get();
    if (!state || state.phase !== BJPhase.PlayerTurn) return false;
    const hand = state.playerHands[state.activeHandIndex];
    return hand ? canSplit(hand) && state.chips >= hand.bet : false;
  },

  canPlayerDouble: () => {
    const { state } = get();
    if (!state || state.phase !== BJPhase.PlayerTurn) return false;
    const hand = state.playerHands[state.activeHandIndex];
    return hand ? canDoubleDown(hand) && state.chips >= hand.bet : false;
  },
}), {
  name: 'blackjack-game',
  partialize: (s) => ({ state: s.state }),
}));
