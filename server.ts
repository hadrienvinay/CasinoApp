import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import next from 'next';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  markDisconnected,
  reconnectPlayer,
  getRoomBySocketId,
  getRoom,
  toRoomInfo,
} from './src/multiplayer/room-manager';
import { GameController } from './src/multiplayer/game-controller';
import type { RoomConfig } from './src/multiplayer/types';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);
  const io = new SocketServer(httpServer, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // --- Create Room ---
    socket.on('create-room', (data: { playerName: string; config: RoomConfig }) => {
      try {
        const room = createRoom(socket.id, data.playerName, data.config);
        socket.join(room.roomId);
        socket.emit('room-created', { roomId: room.roomId });
        io.to(room.roomId).emit('room-update', toRoomInfo(room));
      } catch (err: unknown) {
        socket.emit('error', { message: (err as Error).message });
      }
    });

    // --- Join Room ---
    socket.on('join-room', (data: { roomId: string; playerName: string }) => {
      try {
        // Try reconnection first
        const existingRoom = getRoom(data.roomId);
        if (existingRoom && existingRoom.status === 'playing') {
          const result = reconnectPlayer(socket.id, data.roomId, data.playerName);
          if (result) {
            socket.join(data.roomId);
            if (result.room.gameController) {
              result.room.gameController.handleReconnect(result.oldSocketId, socket.id);
            }
            io.to(data.roomId).emit('room-update', toRoomInfo(result.room));
            broadcastGameState(result.room);
            return;
          }
        }

        const room = joinRoom(data.roomId, socket.id, data.playerName);
        socket.join(room.roomId);
        io.to(room.roomId).emit('room-update', toRoomInfo(room));
      } catch (err: unknown) {
        socket.emit('error', { message: (err as Error).message });
      }
    });

    // --- Leave Room ---
    socket.on('leave-room', () => {
      handleLeave(socket);
    });

    // --- Start Game ---
    socket.on('start-game', () => {
      const room = getRoomBySocketId(socket.id);
      if (!room) return socket.emit('error', { message: 'Not in a room' });
      if (room.hostId !== socket.id) return socket.emit('error', { message: 'Only host can start' });
      if (room.players.size < 2) return socket.emit('error', { message: 'Need at least 2 players' });

      room.status = 'playing';

      const broadcastFn = () => broadcastGameState(room);
      const timerFn = (playerId: string, remainingMs: number) => {
        io.to(room.roomId).emit('turn-timer', { playerId, remainingMs });
      };

      const controller = new GameController(
        Array.from(room.players.values()),
        room.config,
        broadcastFn,
        timerFn,
      );
      room.gameController = controller;

      io.to(room.roomId).emit('room-update', toRoomInfo(room));
      controller.startGame();
    });

    // --- Player Action ---
    socket.on('player-action', (data: { action: { type: string; amount: number } }) => {
      const room = getRoomBySocketId(socket.id);
      if (!room?.gameController) return socket.emit('error', { message: 'No active game' });

      const result = room.gameController.handleAction(socket.id, data.action as never);
      if (result.error) {
        socket.emit('error', { message: result.error });
      }
    });

    // --- Rebuy ---
    socket.on('rebuy', () => {
      const room = getRoomBySocketId(socket.id);
      if (!room?.gameController) return socket.emit('error', { message: 'No active game' });

      room.gameController.handleRebuy(socket.id);
    });

    // --- Change Blinds ---
    socket.on('change-blinds', (data: { direction: 'up' | 'down' }) => {
      const room = getRoomBySocketId(socket.id);
      if (!room?.gameController) return socket.emit('error', { message: 'No active game' });
      if (room.hostId !== socket.id) return socket.emit('error', { message: 'Only host can change blinds' });

      room.gameController.changeBlinds(data.direction);
      // Update room config too so it persists across hands
      const state = room.gameController.getState();
      room.config.smallBlind = state.config.smallBlind;
      room.config.bigBlind = state.config.bigBlind;
    });

    // --- New Hand ---
    socket.on('new-hand', () => {
      const room = getRoomBySocketId(socket.id);
      if (!room?.gameController) return socket.emit('error', { message: 'No active game' });
      if (room.hostId !== socket.id) return socket.emit('error', { message: 'Only host can start next hand' });

      room.gameController.startNextHand();
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`);
      const room = getRoomBySocketId(socket.id);
      if (!room) return;

      if (room.status === 'playing' && room.gameController) {
        // Mark disconnected, don't remove from game
        markDisconnected(socket.id);
        room.gameController.handleDisconnect(socket.id);
        io.to(room.roomId).emit('room-update', toRoomInfo(room));
      } else {
        handleLeave(socket);
      }
    });

    function handleLeave(sock: typeof socket) {
      const room = getRoomBySocketId(sock.id);
      if (!room) return;
      const roomId = room.roomId;

      const { room: updatedRoom, deleted } = leaveRoom(sock.id);
      sock.leave(roomId);

      if (!deleted && updatedRoom) {
        io.to(roomId).emit('room-update', toRoomInfo(updatedRoom));
      }
    }

    function broadcastGameState(room: NonNullable<ReturnType<typeof getRoomBySocketId>>) {
      if (!room.gameController) return;
      for (const [socketId, player] of room.players) {
        if (!player.isConnected) continue;
        const data = room.gameController.getFilteredStateForPlayer(socketId);
        io.to(socketId).emit('game-state', data);
      }
    }
  });

  // Next.js handles all HTTP requests
  server.all('{*path}', (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
