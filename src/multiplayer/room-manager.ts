import { RoomConfig, RoomPlayer, RoomInfo } from './types';
import { GameController } from './game-controller';

export interface Room {
  roomId: string;
  config: RoomConfig;
  players: Map<string, RoomPlayer>;
  hostId: string;
  status: 'waiting' | 'playing';
  gameController: GameController | null;
}

// In-memory storage
const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, string>();

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id: string;
  do {
    id = '';
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(id));
  return id;
}

function getNextSeatIndex(room: Room): number {
  const taken = new Set<number>();
  for (const p of room.players.values()) {
    taken.add(p.seatIndex);
  }
  for (let i = 0; i < room.config.maxPlayers; i++) {
    if (!taken.has(i)) return i;
  }
  return -1;
}

export function createRoom(
  hostSocketId: string,
  playerName: string,
  config: RoomConfig,
): Room {
  const roomId = generateRoomId();
  const host: RoomPlayer = {
    id: hostSocketId,
    name: playerName,
    seatIndex: 0,
    isHost: true,
    isConnected: true,
  };

  const room: Room = {
    roomId,
    config,
    players: new Map([[hostSocketId, host]]),
    hostId: hostSocketId,
    status: 'waiting',
    gameController: null,
  };

  rooms.set(roomId, room);
  socketToRoom.set(hostSocketId, roomId);
  return room;
}

export function joinRoom(
  roomId: string,
  socketId: string,
  playerName: string,
): Room {
  const room = rooms.get(roomId);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'waiting') throw new Error('Game already in progress');
  if (room.players.size >= room.config.maxPlayers) throw new Error('Room is full');
  if (room.players.has(socketId)) throw new Error('Already in room');

  const seatIndex = getNextSeatIndex(room);
  if (seatIndex === -1) throw new Error('No seats available');

  const player: RoomPlayer = {
    id: socketId,
    name: playerName,
    seatIndex,
    isHost: false,
    isConnected: true,
  };

  room.players.set(socketId, player);
  socketToRoom.set(socketId, roomId);
  return room;
}

export function leaveRoom(socketId: string): { room: Room | null; deleted: boolean } {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return { room: null, deleted: false };

  const room = rooms.get(roomId);
  if (!room) {
    socketToRoom.delete(socketId);
    return { room: null, deleted: false };
  }

  room.players.delete(socketId);
  socketToRoom.delete(socketId);

  if (room.players.size === 0) {
    rooms.delete(roomId);
    return { room: null, deleted: true };
  }

  // Transfer host if host left
  if (room.hostId === socketId) {
    const nextPlayer = room.players.values().next().value;
    if (nextPlayer) {
      room.hostId = nextPlayer.id;
      nextPlayer.isHost = true;
    }
  }

  return { room, deleted: false };
}

export function markDisconnected(socketId: string): Room | null {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return null;
  const room = rooms.get(roomId);
  if (!room) return null;

  const player = room.players.get(socketId);
  if (player) {
    player.isConnected = false;
  }
  return room;
}

export function reconnectPlayer(
  newSocketId: string,
  roomId: string,
  playerName: string,
): { room: Room; oldSocketId: string } | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  // Find the disconnected player by name
  for (const [sid, player] of room.players) {
    if (player.name === playerName && !player.isConnected) {
      const oldSid = sid;

      // Remove old entry
      room.players.delete(sid);
      socketToRoom.delete(sid);

      // Add new entry with same seat/host status
      player.id = newSocketId;
      player.isConnected = true;
      room.players.set(newSocketId, player);
      socketToRoom.set(newSocketId, roomId);

      if (room.hostId === oldSid) {
        room.hostId = newSocketId;
      }

      return { room, oldSocketId: oldSid };
    }
  }
  return null;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function getRoomBySocketId(socketId: string): Room | undefined {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return undefined;
  return rooms.get(roomId);
}

export function toRoomInfo(room: Room): RoomInfo {
  return {
    roomId: room.roomId,
    config: room.config,
    players: Array.from(room.players.values()),
    status: room.status,
  };
}
