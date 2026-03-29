import { describe, it, expect } from 'vitest';
import { createInitialState, startHand, advance } from '../game-machine';
import { ActionType, GameConfig, Phase, PokerVariant } from '../types';

const config: GameConfig = {
  playerCount: 4,
  startingChips: 1000,
  smallBlind: 10,
  bigBlind: 20,
  aiDifficulty: 'easy',
  variant: PokerVariant.TexasHoldem,
};

describe('game-machine', () => {
  it('should create initial state with correct players', () => {
    const state = createInitialState(config);
    expect(state.players).toHaveLength(4);
    expect(state.players[0].isHuman).toBe(true);
    expect(state.players[1].isHuman).toBe(false);
    expect(state.phase).toBe(Phase.Idle);
  });

  it('should start a hand with blinds and cards dealt', () => {
    const initial = createInitialState(config);
    const state = startHand(initial);

    expect(state.phase).toBe(Phase.PreFlop);
    expect(state.handNumber).toBe(1);
    expect(state.pot).toBe(30); // SB 10 + BB 20

    // All players should have hole cards
    state.players.forEach((p) => {
      expect(p.holeCards).toHaveLength(2);
    });

    // Deck should be missing dealt cards
    expect(state.deck).toHaveLength(52 - 4 * 2);
  });

  it('should handle a full hand where everyone folds', () => {
    const initial = createInitialState(config);
    let state = startHand(initial);

    // Everyone folds except one
    for (let i = 0; i < 3; i++) {
      state = advance(state, { type: ActionType.Fold, amount: 0 });
    }

    expect(state.phase).toBe(Phase.Settle);
    expect(state.winners).toHaveLength(1);
  });

  it('should advance through all phases with checks/calls', () => {
    const initial = createInitialState(config);
    let state = startHand(initial);

    expect(state.phase).toBe(Phase.PreFlop);

    // Pre-flop: UTG and others call, BB checks
    // UTG calls
    state = advance(state, { type: ActionType.Call, amount: 20 - state.players[state.activePlayerIndex].currentBet });
    // Next player calls
    state = advance(state, { type: ActionType.Call, amount: 20 - state.players[state.activePlayerIndex].currentBet });

    // SB completes
    if (state.phase === Phase.PreFlop) {
      state = advance(state, { type: ActionType.Call, amount: 20 - state.players[state.activePlayerIndex].currentBet });
    }
    // BB checks
    if (state.phase === Phase.PreFlop) {
      state = advance(state, { type: ActionType.Check, amount: 0 });
    }

    // Should be on flop or later
    expect([Phase.Flop, Phase.Turn, Phase.River, Phase.Showdown, Phase.Settle]).toContain(state.phase);

    if (state.phase === Phase.Flop) {
      expect(state.communityCards).toHaveLength(3);
    }
  });

  it('should handle all-in correctly', () => {
    const cfg: GameConfig = {
      ...config,
      startingChips: 100,
      smallBlind: 10,
      bigBlind: 20,
    };
    const initial = createInitialState(cfg);
    let state = startHand(initial);

    // First player goes all-in
    state = advance(state, { type: ActionType.AllIn, amount: state.players[state.activePlayerIndex].chips });

    // Others fold
    while (state.phase !== Phase.Settle && state.phase !== Phase.Showdown) {
      state = advance(state, { type: ActionType.Fold, amount: 0 });
    }

    expect([Phase.Settle, Phase.Showdown]).toContain(state.phase);
    expect(state.winners.length).toBeGreaterThan(0);
  });

  it('should maintain chip conservation', () => {
    const initial = createInitialState(config);
    const totalChipsBefore = initial.players.reduce((s, p) => s + p.chips, 0);

    let state = startHand(initial);

    // Play a quick hand: everyone folds
    for (let i = 0; i < 3; i++) {
      if (state.phase === Phase.Settle) break;
      state = advance(state, { type: ActionType.Fold, amount: 0 });
    }

    const totalChipsAfter = state.players.reduce((s, p) => s + p.chips, 0);
    expect(totalChipsAfter).toBe(totalChipsBefore);
  });
});
