import { PlayerAction, GameState } from '@/engine/types';

export interface RoomConfig {
  smallBlind: number;
  bigBlind: number;
  startingChips: number;
  maxPlayers: number; // 2-7
}

export interface RoomPlayer {
  id: string; // socket ID
  name: string;
  seatIndex: number;
  isHost: boolean;
  isConnected: boolean;
}

export interface RoomInfo {
  roomId: string;
  config: RoomConfig;
  players: RoomPlayer[];
  status: 'waiting' | 'playing';
}

// Client -> Server messages
export interface ClientMessages {
  'create-room': { playerName: string; config: RoomConfig };
  'join-room': { roomId: string; playerName: string };
  'leave-room': Record<string, never>;
  'start-game': Record<string, never>;
  'player-action': { action: PlayerAction };
  'new-hand': Record<string, never>;
  rebuy: Record<string, never>;
  'change-blinds': { direction: 'up' | 'down' };
}

// Server -> Client messages
export interface ServerMessages {
  'room-created': { roomId: string };
  'room-update': RoomInfo;
  'game-state': {
    state: GameState;
    availableActions: PlayerAction[];
    isYourTurn: boolean;
  };
  'turn-timer': { playerId: string; remainingMs: number };
  error: { message: string };
}
