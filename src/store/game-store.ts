import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  GameState,
  GameConfig,
  Phase,
  ActionType,
  PlayerAction,
  Player,
  PokerVariant,
} from '@/engine/types';
import { createInitialState, startHand, advance, isDrawPhase, advanceRunout } from '@/engine/game-machine';
import { getAvailableActions } from '@/engine/betting';
import { getAIDecision, getAIDrawDecision, getAIThinkDelay } from '@/ai/ai-player';
import { recordHumanAction } from '@/ai/strategies/hard';
import { playCheck, playFold, playAllIn, playChipBet, playWinChime } from '@/lib/sounds';

interface GameStore {
  state: GameState | null;
  isAnimating: boolean;
  isAIThinking: boolean;
  handHistory: string[];
  showOpponentHands: boolean;
  showStackInBlinds: boolean;

  // Actions
  initGame: (config: GameConfig) => void;
  newHand: () => void;
  submitAction: (action: PlayerAction) => void;
  submitDraw: (indices: number[]) => void;
  processAITurns: () => Promise<void>;
  processRunout: () => Promise<void>;
  setAnimating: (v: boolean) => void;
  addHistoryEntry: (entry: string) => void;
  toggleShowOpponentHands: () => void;
  toggleShowStackInBlinds: () => void;

  // Selectors
  getHumanPlayer: () => Player | null;
  isHumanTurn: () => boolean;
  getAvailableActions: () => PlayerAction[];
}

function formatAction(playerName: string, action: PlayerAction): string {
  switch (action.type) {
    case ActionType.Fold:
      return `${playerName} folds`;
    case ActionType.Check:
      return `${playerName} checks`;
    case ActionType.Call:
      return `${playerName} calls $${action.amount}`;
    case ActionType.Raise:
      return `${playerName} raises $${action.amount}`;
    case ActionType.AllIn:
      return `${playerName} goes all-in $${action.amount}`;
    case ActionType.Draw:
      return action.discardIndices && action.discardIndices.length > 0
        ? `${playerName} draws ${action.discardIndices.length}`
        : `${playerName} stands pat`;
    default:
      return `${playerName} acts`;
  }
}

export const useGameStore = create<GameStore>()(persist((set, get) => ({
  state: null,
  isAnimating: false,
  isAIThinking: false,
  handHistory: [],
  showOpponentHands: false,
  showStackInBlinds: false,

  initGame: (config: GameConfig) => {
    const initial = createInitialState(config);
    set({ state: initial, handHistory: [] });
  },

  newHand: () => {
    const { state } = get();
    if (!state) return;
    const newState = startHand(state);

    const entries: string[] = [];
    entries.push(`--- Hand #${newState.handNumber} ---`);

    // Log blinds
    const count = newState.players.length;
    const sbIndex = count === 2
      ? newState.dealerIndex
      : (newState.dealerIndex + 1) % count;
    const bbIndex = count === 2
      ? (newState.dealerIndex + 1) % count
      : (newState.dealerIndex + 2) % count;
    const sbPlayer = newState.players[sbIndex];
    const bbPlayer = newState.players[bbIndex];
    entries.push(`${sbPlayer.name} posts SB $${newState.config.smallBlind}`);
    entries.push(`${bbPlayer.name} posts BB $${newState.config.bigBlind}`);

    set((s) => ({
      state: newState,
      handHistory: [...s.handHistory, ...entries],
    }));

    // If AI is first to act, process their turns
    if (!get().isHumanTurn()) {
      get().processAITurns();
    }
  },

  submitAction: (action: PlayerAction) => {
    const { state, isAnimating, isAIThinking } = get();
    if (!state || isAnimating || isAIThinking) return;
    if (!get().isHumanTurn()) return;

    const player = state.players[state.activePlayerIndex];
    const entry = formatAction(player.name, action);

    // Record for opponent modeling
    recordHumanAction(action.type);

    // Play action sound
    playActionSound(action.type);

    const prevPhase = state.phase;
    const newState = advance(state, action);

    const entries: string[] = [entry];
    // Log phase transitions
    if (newState.phase !== prevPhase && newState.phase !== Phase.Settle && newState.phase !== Phase.Showdown) {
      entries.push(`-- ${phaseLabel(newState.phase)} --`);
    }
    // Log winners
    if (newState.phase === Phase.Settle) {
      playWinChime();
      for (const w of newState.winners) {
        const wp = newState.players.find((p) => p.id === w.playerId);
        entries.push(`* ${wp?.name} wins $${w.amount} (${w.handName})`);
      }
    }

    set((s) => ({
      state: newState,
      handHistory: [...s.handHistory, ...entries],
    }));

    // All-in runout: auto-advance phases with pauses
    if (newState.allInRunout) {
      get().processRunout();
      return;
    }

    // After human acts, process AI turns if needed
    if (newState.phase !== Phase.Settle && newState.phase !== Phase.Showdown) {
      if (!isHumanTurnCheck(newState)) {
        get().processAITurns();
      }
    }
  },

  submitDraw: (indices: number[]) => {
    const { state, isAnimating, isAIThinking } = get();
    if (!state || isAnimating || isAIThinking) return;
    if (!get().isHumanTurn()) return;

    const action: PlayerAction = {
      type: ActionType.Draw,
      amount: 0,
      discardIndices: indices,
    };

    const player = state.players[state.activePlayerIndex];
    const entry = formatAction(player.name, action);

    const prevPhase = state.phase;
    const newState = advance(state, action);

    const entries: string[] = [entry];
    if (newState.phase !== prevPhase && newState.phase !== Phase.Settle && newState.phase !== Phase.Showdown) {
      entries.push(`-- ${phaseLabel(newState.phase)} --`);
    }
    if (newState.phase === Phase.Settle) {
      for (const w of newState.winners) {
        const wp = newState.players.find((p) => p.id === w.playerId);
        entries.push(`* ${wp?.name} wins $${w.amount} (${w.handName})`);
      }
    }

    set((s) => ({
      state: newState,
      handHistory: [...s.handHistory, ...entries],
    }));

    if (newState.phase !== Phase.Settle && newState.phase !== Phase.Showdown) {
      if (!isHumanTurnCheck(newState)) {
        get().processAITurns();
      }
    }
  },

  processAITurns: async () => {
    set({ isAIThinking: true });

    const processNext = async () => {
      const { state } = get();
      if (!state) return;
      if (state.phase === Phase.Settle || state.phase === Phase.Showdown) {
        set({ isAIThinking: false });
        return;
      }
      if (isHumanTurnCheck(state)) {
        set({ isAIThinking: false });
        return;
      }

      const player = state.players[state.activePlayerIndex];
      if (!player || player.isHuman) {
        set({ isAIThinking: false });
        return;
      }

      // AI "thinks"
      await delay(getAIThinkDelay());

      let decision: PlayerAction;

      // If we're in a draw phase, make a draw decision
      if (isDrawPhase(state.phase)) {
        const variant = state.config.variant ?? PokerVariant.TexasHoldem;
        const discardIndices = getAIDrawDecision(
          state.config.aiDifficulty,
          player.holeCards ?? [],
          variant,
        );
        decision = {
          type: ActionType.Draw,
          amount: 0,
          discardIndices,
        };
      } else {
        const actions = getAvailableActions(state, player);
        decision = getAIDecision(
          state.config.aiDifficulty,
          player.holeCards!,
          state.communityCards,
          state,
          actions,
        );
      }

      const entry = formatAction(player.name, decision);
      // Play AI action sound
      playActionSound(decision.type);

      const prevPhase = state.phase;
      const newState = advance(state, decision);

      const entries: string[] = [entry];
      // Log phase transitions
      if (newState.phase !== prevPhase && newState.phase !== Phase.Settle && newState.phase !== Phase.Showdown) {
        entries.push(`-- ${phaseLabel(newState.phase)} --`);
      }
      // Log winners
      if (newState.phase === Phase.Settle) {
        playWinChime();
        for (const w of newState.winners) {
          const wp = newState.players.find((p) => p.id === w.playerId);
          entries.push(`* ${wp?.name} wins $${w.amount} (${w.handName})`);
        }
      }

      set((s) => ({
        state: newState,
        handHistory: [...s.handHistory, ...entries],
      }));

      // All-in runout: auto-advance phases with pauses
      if (newState.allInRunout) {
        set({ isAIThinking: false });
        get().processRunout();
        return;
      }

      // Small pause so the player can see the AI's action before the next one
      await delay(400);

      // Continue processing if next player is also AI
      await processNext();
    };

    await processNext();
  },

  processRunout: async () => {
    const waitForAnimation = async () => {
      // Wait until isAnimating becomes false
      while (get().isAnimating) {
        await delay(100);
      }
    };

    const runStep = async () => {
      const { state } = get();
      if (!state || !state.allInRunout) return;
      if (state.phase === Phase.Showdown || state.phase === Phase.Settle) return;

      // Brief pause before dealing next community card
      await delay(800);

      const prevPhase = state.phase;
      const newState = advanceRunout(state);

      const entries: string[] = [];
      if (newState.phase !== prevPhase) {
        entries.push(`-- ${phaseLabel(newState.phase)} --`);
      }
      if (newState.phase === Phase.Settle || newState.phase === Phase.Showdown) {
        for (const w of newState.winners) {
          const wp = newState.players.find((p) => p.id === w.playerId);
          entries.push(`* ${wp?.name} wins $${w.amount} (${w.handName})`);
        }
      }

      set((s) => ({
        state: newState,
        handHistory: [...s.handHistory, ...entries],
      }));

      // Wait for the card deal/flip animation to finish
      await delay(300);
      await waitForAnimation();

      // Pause after the card is revealed so the player can see it
      await delay(1200);

      // Continue if still running out
      if (newState.allInRunout && newState.phase !== Phase.Showdown && newState.phase !== Phase.Settle) {
        await runStep();
      }
    };

    await runStep();
  },

  setAnimating: (v: boolean) => set({ isAnimating: v }),

  addHistoryEntry: (entry: string) => {
    set((s) => ({ handHistory: [...s.handHistory, entry] }));
  },

  toggleShowOpponentHands: () => {
    set((s) => ({ showOpponentHands: !s.showOpponentHands }));
  },

  toggleShowStackInBlinds: () => {
    set((s) => ({ showStackInBlinds: !s.showStackInBlinds }));
  },

  getHumanPlayer: () => {
    const { state } = get();
    return state?.players.find((p) => p.isHuman) ?? null;
  },

  isHumanTurn: () => {
    const { state } = get();
    if (!state) return false;
    return isHumanTurnCheck(state);
  },

  getAvailableActions: () => {
    const { state } = get();
    if (!state) return [];
    const player = state.players[state.activePlayerIndex];
    if (!player?.isHuman) return [];
    return getAvailableActions(state, player);
  },
}), {
  name: 'poker-game',
  partialize: (s) => ({
    state: s.state,
    handHistory: s.handHistory,
  }),
}));

function playActionSound(type: ActionType) {
  switch (type) {
    case ActionType.Check: playCheck(); break;
    case ActionType.Fold: playFold(); break;
    case ActionType.AllIn: playAllIn(); break;
    case ActionType.Call:
    case ActionType.Raise: playChipBet(); break;
  }
}

function isHumanTurnCheck(state: GameState): boolean {
  const player = state.players[state.activePlayerIndex];
  return (player?.isHuman && !player.isAllIn && !player.isFolded) ?? false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function phaseLabel(phase: Phase): string {
  switch (phase) {
    case Phase.PreFlop: return 'Pre-Flop';
    case Phase.Flop: return 'Flop';
    case Phase.Turn: return 'Turn';
    case Phase.River: return 'River';
    case Phase.Showdown: return 'Showdown';
    case Phase.Draw1: return 'Draw 1';
    case Phase.Draw2: return 'Draw 2';
    case Phase.Draw3: return 'Draw 3';
    default: return phase;
  }
}
