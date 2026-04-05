import { create } from 'zustand';
import { GameState, PlayerAction, ActionType } from '@/engine/types';
import { playCheck, playFold, playAllIn, playChipBet, playRaise } from '@/lib/sounds';
import { RoomInfo, RoomConfig } from '@/multiplayer/types';
import { getSocket, connectSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';

interface MultiplayerStore {
  // Connection
  isConnected: boolean;
  mySocketId: string | null;

  // Room
  roomInfo: RoomInfo | null;

  // Game
  gameState: GameState | null;
  availableActions: PlayerAction[];
  isMyTurn: boolean;
  turnTimer: { playerId: string; remainingMs: number } | null;

  // Display
  showStackInBlinds: boolean;

  // Error
  error: string | null;

  // Actions (emit to server)
  createRoom: (playerName: string, config: RoomConfig) => void;
  toggleShowStackInBlinds: () => void;
  joinRoom: (roomId: string, playerName: string) => void;
  leaveRoom: () => void;
  startGame: () => void;
  submitAction: (action: PlayerAction) => void;
  nextHand: () => void;
  rebuy: () => void;
  changeBlinds: (direction: 'up' | 'down') => void;

  // Internal
  _setConnected: (connected: boolean, socketId: string | null) => void;
  _setRoomInfo: (info: RoomInfo) => void;
  _setGameState: (data: {
    state: GameState;
    availableActions: PlayerAction[];
    isYourTurn: boolean;
    lastAction: { playerId: string; type: string; amount: number } | null;
  }) => void;
  _setTurnTimer: (timer: { playerId: string; remainingMs: number }) => void;
  _setError: (msg: string) => void;
  _reset: () => void;
}

export const useMultiplayerStore = create<MultiplayerStore>()((set) => ({
  isConnected: false,
  mySocketId: null,
  roomInfo: null,
  gameState: null,
  availableActions: [],
  isMyTurn: false,
  turnTimer: null,
  showStackInBlinds: false,
  error: null,

  createRoom: (playerName: string, config: RoomConfig) => {
    const socket = connectSocket();
    socket.emit('create-room', { playerName, config });
  },

  joinRoom: (roomId: string, playerName: string) => {
    const socket = connectSocket();
    socket.emit('join-room', { roomId, playerName });
  },

  leaveRoom: () => {
    const socket = getSocket();
    socket.emit('leave-room', {});
    set({ roomInfo: null, gameState: null, availableActions: [], isMyTurn: false, turnTimer: null });
  },

  startGame: () => {
    const socket = getSocket();
    socket.emit('start-game', {});
  },

  submitAction: (action: PlayerAction) => {
    const socket = getSocket();
    socket.emit('player-action', { action });
  },

  nextHand: () => {
    const socket = getSocket();
    socket.emit('new-hand', {});
  },

  rebuy: () => {
    const socket = getSocket();
    socket.emit('rebuy', {});
  },

  changeBlinds: (direction: 'up' | 'down') => {
    const socket = getSocket();
    socket.emit('change-blinds', { direction });
  },

  toggleShowStackInBlinds: () => set((s) => ({ showStackInBlinds: !s.showStackInBlinds })),

  _setConnected: (connected, socketId) => set({ isConnected: connected, mySocketId: socketId }),
  _setRoomInfo: (info) => set({ roomInfo: info }),
  _setGameState: (data) => {
    // Play sound for the last action — once per unique action
    const act = data.lastAction;
    if (act) {
      const actionKey = `${act.playerId}:${act.type}:${act.amount}`;
      if (actionKey !== lastPlayedActionKey) {
        lastPlayedActionKey = actionKey;
        switch (act.type) {
          case ActionType.Check: playCheck(); break;
          case ActionType.Fold: playFold(); break;
          case ActionType.Call: playChipBet(); break;
          case ActionType.Raise: playRaise(); break;
          case ActionType.AllIn: playAllIn(); break;
        }
      }
    } else {
      lastPlayedActionKey = '';
    }
    set({
      gameState: data.state,
      availableActions: data.availableActions,
      isMyTurn: data.isYourTurn,
      turnTimer: null,
    });
  },
  _setTurnTimer: (timer) => set({ turnTimer: timer }),
  _setError: (msg) => set({ error: msg }),
  _reset: () =>
    set({
      roomInfo: null,
      gameState: null,
      availableActions: [],
      isMyTurn: false,
      turnTimer: null,
      error: null,
    }),
}));

// Track last played action to avoid duplicate sounds on repeated broadcasts
let lastPlayedActionKey = '';

let listenersInitialized = false;

export function initMultiplayerListeners(socket: Socket): void {
  if (listenersInitialized) return;
  listenersInitialized = true;

  socket.on('connect', () => {
    useMultiplayerStore.getState()._setConnected(true, socket.id ?? null);
  });

  socket.on('disconnect', () => {
    useMultiplayerStore.getState()._setConnected(false, null);
  });

  socket.on('room-created', ({ roomId }: { roomId: string }) => {
    // The room-update event will follow, but we store roomId early for navigation
    const current = useMultiplayerStore.getState().roomInfo;
    if (!current) {
      // Temporarily set a minimal roomInfo so the page can navigate
      useMultiplayerStore.setState({
        roomInfo: {
          roomId,
          config: { smallBlind: 0, bigBlind: 0, startingChips: 0, maxPlayers: 0 },
          players: [],
          status: 'waiting',
        },
      });
    }
  });

  socket.on('room-update', (info: RoomInfo) => {
    useMultiplayerStore.getState()._setRoomInfo(info);
  });

  socket.on(
    'game-state',
    (data: {
      state: GameState;
      availableActions: PlayerAction[];
      isYourTurn: boolean;
      lastAction: { playerId: string; type: string; amount: number } | null;
    }) => {
      useMultiplayerStore.getState()._setGameState(data);
    },
  );

  socket.on(
    'turn-timer',
    (timer: { playerId: string; remainingMs: number }) => {
      useMultiplayerStore.getState()._setTurnTimer(timer);
    },
  );

  socket.on('error', (data: { message: string }) => {
    useMultiplayerStore.getState()._setError(data.message);
  });
}
