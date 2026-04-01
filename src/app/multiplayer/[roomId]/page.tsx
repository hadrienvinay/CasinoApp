'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useMultiplayerStore, initMultiplayerListeners } from '@/store/multiplayer-store';
import { connectSocket } from '@/lib/socket';
import MultiplayerLobby from '@/ui/MultiplayerLobby';
import MultiplayerActionBar from '@/ui/MultiplayerActionBar';
import MultiplayerWinnerBanner from '@/ui/MultiplayerWinnerBanner';
import LandscapePrompt from '@/ui/LandscapePrompt';
import { playGameStart } from '@/lib/sounds';

const PokerCanvas = dynamic(() => import('@/pixi/PokerCanvas'), { ssr: false });

const BASE_W = 1280;
const BASE_H = 720;

export default function MultiplayerRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const roomInfo = useMultiplayerStore((s) => s.roomInfo);
  const gameState = useMultiplayerStore((s) => s.gameState);
  const mySocketId = useMultiplayerStore((s) => s.mySocketId);
  const isConnected = useMultiplayerStore((s) => s.isConnected);
  const joinRoom = useMultiplayerStore((s) => s.joinRoom);
  const leaveRoom = useMultiplayerStore((s) => s.leaveRoom);

  const [scale, setScale] = useState(1);
  const [hasJoined, setHasJoined] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  // Connect socket on mount
  useEffect(() => {
    const socket = connectSocket();
    initMultiplayerListeners(socket);
  }, []);

  // Auto-join when connected (if we haven't already)
  useEffect(() => {
    if (!isConnected || hasJoined) return;

    if (roomInfo?.roomId === roomId) {
      setHasJoined(true);
      return;
    }

    const saved = localStorage.getItem('mp-player-name');
    if (saved) {
      setPlayerName(saved);
      joinRoom(roomId, saved);
      setHasJoined(true);
    } else {
      setShowNameInput(true);
    }
  }, [isConnected, hasJoined, roomInfo, roomId, joinRoom]);

  const handleJoinWithName = () => {
    if (!playerName.trim()) return;
    localStorage.setItem('mp-player-name', playerName.trim());
    joinRoom(roomId, playerName.trim());
    setHasJoined(true);
    setShowNameInput(false);
  };

  // Play game start sound when the game transitions from lobby to active
  useEffect(() => {
    if (!gameState) return;
    const timer = setTimeout(() => playGameStart(), 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!gameState]);

  const updateScale = useCallback(() => {
    const scaleX = window.innerWidth / BASE_W;
    const scaleY = window.innerHeight / BASE_H;
    setScale(Math.min(scaleX, scaleY));
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale]);

  // Name input prompt for new visitors
  if (showNameInput) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-green-950 flex items-center justify-center">
        <div className="bg-gray-800/80 rounded-2xl p-6 sm:p-8 max-w-sm w-full mx-4 backdrop-blur-sm text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Join Table</h2>
          <p className="text-gray-400 mb-4">Room: <span className="text-yellow-400 font-mono">{roomId}</span></p>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            maxLength={15}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinWithName()}
            className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 mb-4 min-h-[44px]"
          />
          <button
            onClick={handleJoinWithName}
            disabled={!playerName.trim()}
            className={`w-full py-3 rounded-xl font-bold text-lg sm:text-xl transition-colors min-h-[48px] ${
              playerName.trim()
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  // Waiting for connection
  if (!isConnected || !roomInfo) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-green-950 flex items-center justify-center">
        <div className="text-white text-lg sm:text-xl">Connecting...</div>
      </div>
    );
  }

  // Lobby phase
  if (roomInfo.status === 'waiting') {
    return <MultiplayerLobby />;
  }

  // Game phase
  if (!gameState) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-lg sm:text-xl">Loading game...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      {/* Scaled canvas container */}
      <div
        className="relative"
        style={{
          width: BASE_W,
          height: BASE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <PokerCanvas
          externalState={gameState}
          localPlayerId={mySocketId ?? undefined}
        />
      </div>

      {/* Interactive UI — outside scaled container */}
      <div className="fixed inset-0 pointer-events-none z-10">
        <div className="pointer-events-auto">
          <MultiplayerActionBar />
        </div>
        <div className="pointer-events-auto">
          <MultiplayerWinnerBanner />
        </div>

        {/* HUD */}
        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-gray-900/80 backdrop-blur-sm rounded-xl px-3 py-2 sm:px-4 sm:py-3 flex flex-col gap-1.5 sm:gap-2 pointer-events-auto">
          <div>
            <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider">Room</div>
            <div className="text-xs sm:text-sm font-mono font-bold text-yellow-400">{roomId}</div>
          </div>
          <div>
            <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider">Hand</div>
            <div className="text-sm sm:text-base font-bold text-white">{gameState.handNumber}</div>
          </div>
          <div>
            <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider">Pot</div>
            <div className="text-sm sm:text-base font-bold text-green-400">${gameState.pot}</div>
          </div>
        </div>

        <button
          onClick={() => {
            leaveRoom();
            router.push('/');
          }}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 px-3 py-2 sm:px-4 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors backdrop-blur-sm pointer-events-auto min-h-[36px]"
        >
          Leave
        </button>
      </div>

      <LandscapePrompt />
    </div>
  );
}
