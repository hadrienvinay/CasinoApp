import {
  GameState,
  GameConfig,
  Phase,
  Player,
  PlayerAction,
  ActionType,
  PokerVariant,
  Rank,
  Suit,
  Card,
} from '@/engine/types';
import { createDeck, shuffle } from '@/engine/deck';
import { startHand, advance, advanceRunout } from '@/engine/game-machine';
import { getAvailableActions } from '@/engine/betting';
import { RoomConfig, RoomPlayer } from './types';

const TURN_TIMEOUT_MS = 30_000;
const TIMER_TICK_MS = 1_000;
const RUNOUT_DELAY_MS = 2_500;

// Dummy card for hiding opponents' hands
const DUMMY_CARD: Card = { rank: Rank.Two, suit: Suit.Spades };

type BroadcastFn = () => void;
type TimerBroadcastFn = (playerId: string, remainingMs: number) => void;

export class GameController {
  private state: GameState;
  private broadcastState: BroadcastFn;
  private broadcastTimer: TimerBroadcastFn;
  private turnTimeout: ReturnType<typeof setTimeout> | null = null;
  private turnInterval: ReturnType<typeof setInterval> | null = null;
  private turnStartedAt = 0;
  private settleTimeout: ReturnType<typeof setTimeout> | null = null;
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    roomPlayers: RoomPlayer[],
    config: RoomConfig,
    broadcastState: BroadcastFn,
    broadcastTimer: TimerBroadcastFn,
  ) {
    this.broadcastState = broadcastState;
    this.broadcastTimer = broadcastTimer;

    // Build initial GameState from room players
    const players: Player[] = roomPlayers
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((rp) => ({
        id: rp.id,
        name: rp.name,
        chips: config.startingChips,
        holeCards: null,
        isHuman: true, // All multiplayer players are human
        isFolded: false,
        isAllIn: false,
        currentBet: 0,
        totalBet: 0,
        seatIndex: rp.seatIndex,
        hasActed: false,
      }));

    const gameConfig: GameConfig = {
      playerCount: players.length,
      startingChips: config.startingChips,
      smallBlind: config.smallBlind,
      bigBlind: config.bigBlind,
      aiDifficulty: 'easy', // unused but required by type
      variant: PokerVariant.TexasHoldem,
    };

    this.state = {
      phase: Phase.Idle,
      players,
      communityCards: [],
      deck: shuffle(createDeck()),
      pot: 0,
      sidePots: [],
      dealerIndex: 0,
      activePlayerIndex: 0,
      currentBet: 0,
      minRaise: config.bigBlind,
      handNumber: 0,
      config: gameConfig,
      winners: [],
      drawRound: 0,
    };
  }

  startGame(): void {
    this.state = startHand(this.state);
    this.broadcastState();
    this.startTurnTimer();
  }

  startNextHand(): void {
    // Cancel any pending settle transition
    if (this.settleTimeout) {
      clearTimeout(this.settleTimeout);
      this.settleTimeout = null;
    }

    // Don't start a new hand if fewer than 2 players have chips
    const playersWithChips = this.state.players.filter((p) => p.chips > 0);
    if (playersWithChips.length < 2) {
      // Just broadcast current state — UI should show winner
      this.broadcastState();
      return;
    }

    this.state = startHand(this.state);
    this.broadcastState();
    this.startTurnTimer();
  }

  handleAction(socketId: string, action: PlayerAction): { error?: string } {
    const activePlayer = this.state.players[this.state.activePlayerIndex];
    if (!activePlayer || activePlayer.id !== socketId) {
      return { error: 'Not your turn' };
    }

    // Validate action is legal
    const available = getAvailableActions(this.state, activePlayer);
    const isValid = available.some((a) => {
      if (a.type !== action.type) return false;
      if (action.type === ActionType.Raise) {
        // Enforce minimum raise and cap at player's chips
        const minRaiseAmount = a.amount; // from getAvailableActions
        return action.amount >= minRaiseAmount && action.amount <= activePlayer.chips;
      }
      if (action.type === ActionType.AllIn) {
        // All-in is always the player's full stack
        action.amount = activePlayer.chips;
        return true;
      }
      return true;
    });

    if (!isValid) {
      return { error: 'Invalid action' };
    }

    this.clearTurnTimer();

    const prevPhase = this.state.phase;
    this.state = advance(this.state, action);

    // If we went straight to Settle from a betting phase (showdown scenario),
    // broadcast an intermediate Showdown state so clients can see opponents' cards.
    const isShowdown =
      this.state.phase === Phase.Settle &&
      prevPhase !== Phase.Settle &&
      prevPhase !== Phase.Showdown &&
      this.state.winners.length > 0 &&
      this.state.players.filter((p) => !p.isFolded && p.holeCards).length > 1;

    if (isShowdown) {
      // Broadcast showdown state (with revealed cards) before settle
      const showdownState: GameState = JSON.parse(JSON.stringify(this.state));
      showdownState.phase = Phase.Showdown;
      this.state = showdownState;
      this.broadcastState();

      // After a delay, move to settle
      this.scheduleSettle(JSON.parse(JSON.stringify(this.state)));
      return {};
    }

    this.broadcastState();

    // Handle all-in runout
    if (this.state.allInRunout) {
      this.processRunout();
      return {};
    }

    // Handle settle/showdown
    if (this.state.phase === Phase.Settle || this.state.phase === Phase.Showdown) {
      return {};
    }

    // Start timer for next player
    if (this.state.phase !== prevPhase || this.state.activePlayerIndex !== this.state.players.indexOf(activePlayer)) {
      this.startTurnTimer();
    }

    return {};
  }

  handleDisconnect(socketId: string): void {
    const player = this.state.players.find((p) => p.id === socketId);
    if (!player) return;

    // If it's their turn and they can act (not all-in), auto-fold
    const activePlayer = this.state.players[this.state.activePlayerIndex];
    if (
      activePlayer?.id === socketId &&
      !activePlayer.isFolded &&
      !activePlayer.isAllIn &&
      !this.state.allInRunout
    ) {
      this.handleAction(socketId, { type: ActionType.Fold, amount: 0 });
    }

    // Set 60s disconnect timer
    this.disconnectTimers.set(
      socketId,
      setTimeout(() => {
        this.disconnectTimers.delete(socketId);
        // Mark as permanently folded for future hands
        const p = this.state.players.find((pl) => pl.id === socketId);
        if (p) {
          p.chips = 0; // Will be removed on next startHand
        }
      }, 60_000),
    );
  }

  handleReconnect(oldSocketId: string, newSocketId: string): void {
    const timer = this.disconnectTimers.get(oldSocketId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(oldSocketId);
    }

    // Update player ID in game state
    const player = this.state.players.find((p) => p.id === oldSocketId);
    if (player) {
      player.id = newSocketId;
    }
  }

  getFilteredStateForPlayer(socketId: string): {
    state: GameState;
    availableActions: PlayerAction[];
    isYourTurn: boolean;
  } {
    const clone: GameState = JSON.parse(JSON.stringify(this.state));

    // Remove deck
    clone.deck = [];

    // Filter hole cards — reveal during showdown, settle, or all-in runout
    const isReveal =
      clone.phase === Phase.Showdown ||
      clone.phase === Phase.Settle ||
      !!clone.allInRunout;

    for (const player of clone.players) {
      if (player.id !== socketId && !isReveal) {
        // Send dummy cards (so client shows card backs)
        if (player.holeCards && !player.isFolded) {
          player.holeCards = player.holeCards.map(() => ({ ...DUMMY_CARD }));
        }
      }
    }

    // Available actions
    const activePlayer = clone.players[clone.activePlayerIndex];
    const isYourTurn = activePlayer?.id === socketId &&
      clone.phase !== Phase.Settle &&
      clone.phase !== Phase.Showdown;

    let availableActions: PlayerAction[] = [];
    if (isYourTurn) {
      // Use original state for computation (not the filtered clone)
      const realPlayer = this.state.players[this.state.activePlayerIndex];
      availableActions = getAvailableActions(this.state, realPlayer);
    }

    return { state: clone, availableActions, isYourTurn };
  }

  handleRebuy(socketId: string): void {
    const player = this.state.players.find((p) => p.id === socketId);
    if (!player) return;
    player.chips = this.state.config.startingChips;
    this.broadcastState();
  }

  getState(): GameState {
    return this.state;
  }

  private scheduleSettle(showdownState: GameState): void {
    if (this.settleTimeout) clearTimeout(this.settleTimeout);
    this.settleTimeout = setTimeout(() => {
      this.settleTimeout = null;
      const settleState: GameState = JSON.parse(JSON.stringify(showdownState));
      settleState.phase = Phase.Settle;
      this.state = settleState;
      this.broadcastState();
    }, 3000);
  }

  private startTurnTimer(): void {
    this.clearTurnTimer();

    const activePlayer = this.state.players[this.state.activePlayerIndex];
    if (!activePlayer) return;
    if (this.state.phase === Phase.Settle || this.state.phase === Phase.Showdown) return;

    this.turnStartedAt = Date.now();

    // Broadcast timer every second
    this.turnInterval = setInterval(() => {
      const elapsed = Date.now() - this.turnStartedAt;
      const remaining = Math.max(0, TURN_TIMEOUT_MS - elapsed);
      this.broadcastTimer(activePlayer.id, remaining);
    }, TIMER_TICK_MS);

    // Auto-fold on timeout
    this.turnTimeout = setTimeout(() => {
      this.clearTurnTimer();
      this.handleAction(activePlayer.id, { type: ActionType.Fold, amount: 0 });
    }, TURN_TIMEOUT_MS);
  }

  private clearTurnTimer(): void {
    if (this.turnTimeout) {
      clearTimeout(this.turnTimeout);
      this.turnTimeout = null;
    }
    if (this.turnInterval) {
      clearInterval(this.turnInterval);
      this.turnInterval = null;
    }
  }

  private async processRunout(): Promise<void> {
    let isFirstStep = true;

    const runStep = async () => {
      if (!this.state.allInRunout) return;
      if (
        this.state.phase === Phase.Showdown ||
        this.state.phase === Phase.Settle
      )
        return;

      // Longer initial delay to let client finish dealing/action animations
      await delay(isFirstStep ? RUNOUT_DELAY_MS + 1000 : RUNOUT_DELAY_MS);
      isFirstStep = false;

      this.state = advanceRunout(this.state);

      // If advanceRunout resolved to Settle (after River), insert a Showdown phase
      if (this.state.phase === Phase.Settle && this.state.winners.length > 0) {
        const showdownState: GameState = JSON.parse(JSON.stringify(this.state));
        showdownState.phase = Phase.Showdown;
        this.state = showdownState;
        this.broadcastState();

        // After delay, transition to settle
        this.scheduleSettle(showdownState);
        return;
      }

      this.broadcastState();

      if (
        this.state.allInRunout &&
        this.state.phase !== Phase.Showdown &&
        this.state.phase !== Phase.Settle
      ) {
        await runStep();
      }
    };

    await runStep();
  }

  destroy(): void {
    this.clearTurnTimer();
    if (this.settleTimeout) {
      clearTimeout(this.settleTimeout);
      this.settleTimeout = null;
    }
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
