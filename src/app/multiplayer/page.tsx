'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMultiplayerStore, initMultiplayerListeners } from '@/store/multiplayer-store';
import { connectSocket } from '@/lib/socket';
import { RoomConfig } from '@/multiplayer/types';

export default function MultiplayerPage() {
  const router = useRouter();
  const roomInfo = useMultiplayerStore((s) => s.roomInfo);
  const error = useMultiplayerStore((s) => s.error);
  const createRoom = useMultiplayerStore((s) => s.createRoom);
  const joinRoom = useMultiplayerStore((s) => s.joinRoom);

  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [smallBlind, setSmallBlind] = useState(25);
  const [startingChips, setStartingChips] = useState(5000);
  const [maxPlayers, setMaxPlayers] = useState(6);

  // Load saved name
  useEffect(() => {
    const saved = localStorage.getItem('mp-player-name');
    if (saved) setPlayerName(saved);
  }, []);

  // Init socket listeners
  useEffect(() => {
    const socket = connectSocket();
    initMultiplayerListeners(socket);
  }, []);

  // Navigate to room when created/joined
  useEffect(() => {
    if (roomInfo?.roomId) {
      router.push(`/multiplayer/${roomInfo.roomId}`);
    }
  }, [roomInfo, router]);

  const handleCreate = () => {
    if (!playerName.trim()) return;
    localStorage.setItem('mp-player-name', playerName.trim());
    const config: RoomConfig = {
      smallBlind,
      bigBlind: smallBlind * 2,
      startingChips,
      maxPlayers,
    };
    createRoom(playerName.trim(), config);
  };

  const handleJoin = () => {
    if (!playerName.trim() || !joinCode.trim()) return;
    localStorage.setItem('mp-player-name', playerName.trim());
    joinRoom(joinCode.trim().toUpperCase(), playerName.trim());
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-green-950 flex justify-center overflow-y-auto">
      <div className="bg-gray-800/80 rounded-2xl p-5 sm:p-8 max-w-md w-full mx-3 sm:mx-4 my-auto backdrop-blur-sm shrink-0">
        <h1 className="text-3xl font-bold text-center mb-2 text-white">Multiplayer</h1>
        <p className="text-center text-gray-400 mb-8">Texas Hold&apos;em</p>

        {error && (
          <div className="bg-red-600/20 border border-red-600/40 rounded-lg p-3 mb-4 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Player Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">Your Name</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            maxLength={15}
            className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          />
        </div>

        {/* Create Table */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-white mb-4">Create Table</h2>

          <div className="space-y-4">
            {/* Blinds */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Blinds</label>
              <div className="flex gap-2">
                {[10, 25, 50].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSmallBlind(n)}
                    className={`flex-1 py-2 rounded-lg font-bold transition-colors ${
                      smallBlind === n
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {n}/{n * 2}
                  </button>
                ))}
              </div>
            </div>

            {/* Starting Chips */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Starting Chips</label>
              <div className="flex gap-2">
                {[1000, 5000, 10000].map((n) => (
                  <button
                    key={n}
                    onClick={() => setStartingChips(n)}
                    className={`flex-1 py-2 rounded-lg font-bold transition-colors ${
                      startingChips === n
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    ${n.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Players */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Max Players</label>
              <div className="flex gap-2">
                {[2, 4, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => setMaxPlayers(n)}
                    className={`flex-1 py-2 rounded-lg font-bold transition-colors ${
                      maxPlayers === n
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={!playerName.trim()}
              className={`w-full py-3 rounded-xl font-bold text-xl transition-colors ${
                playerName.trim()
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              Create Table
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 border-t border-gray-700" />
          <span className="text-gray-500 text-sm">OR</span>
          <div className="flex-1 border-t border-gray-700" />
        </div>

        {/* Join Table */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4">Join Table</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Room code"
              maxLength={6}
              className="flex-1 px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 font-mono text-lg tracking-wider uppercase"
            />
            <button
              onClick={handleJoin}
              disabled={!playerName.trim() || !joinCode.trim()}
              className={`px-6 py-2.5 rounded-lg font-bold transition-colors ${
                playerName.trim() && joinCode.trim()
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              Join
            </button>
          </div>
        </div>

        {/* Back */}
        <button
          onClick={() => router.push('/')}
          className="w-full mt-6 py-2 text-gray-400 hover:text-gray-300 text-sm transition-colors"
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
}
