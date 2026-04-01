'use client';

import { useMultiplayerStore } from '@/store/multiplayer-store';

export default function MultiplayerLobby() {
  const roomInfo = useMultiplayerStore((s) => s.roomInfo);
  const mySocketId = useMultiplayerStore((s) => s.mySocketId);
  const startGame = useMultiplayerStore((s) => s.startGame);
  const leaveRoom = useMultiplayerStore((s) => s.leaveRoom);

  if (!roomInfo) return null;

  const isHost = roomInfo.players.find((p) => p.id === mySocketId)?.isHost ?? false;
  const canStart = isHost && roomInfo.players.length >= 2;

  const copyLink = () => {
    navigator.clipboard.writeText(roomInfo.roomId);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-green-950 flex justify-center overflow-y-auto">
      <div className="mt-5 bg-gray-800/90 backdrop-blur-sm rounded-2xl p-5 sm:p-8 max-w-md w-full mx-3 sm:mx-4 my-auto shrink-0">
        <h1 className="text-3xl font-bold text-center mb-2 text-white">Multiplayer Poker</h1>
        <p className="text-center text-gray-400 mb-6">Texas Hold&apos;em</p>

        {/* Room Code */}
        <div className="bg-gray-900/60 rounded-xl p-4 mb-6 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Room Code</p>
          <p className="text-4xl font-mono font-bold text-yellow-400 tracking-[0.3em]">
            {roomInfo.roomId}
          </p>
          <button
            onClick={copyLink}
            className="mt-2 px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
          >
            Copy Link
          </button>
        </div>

        {/* Config Summary */}
        <div className="flex justify-center gap-6 mb-6 text-sm text-gray-400">
          <span>Blinds: {roomInfo.config.smallBlind}/{roomInfo.config.bigBlind}</span>
          <span>Chips: ${roomInfo.config.startingChips}</span>
        </div>

        {/* Player List */}
        <div className="space-y-2 mb-6">
          <p className="text-sm text-gray-400 font-medium">
            Players ({roomInfo.players.length}/{roomInfo.config.maxPlayers})
          </p>
          {Array.from({ length: roomInfo.config.maxPlayers }).map((_, i) => {
            const player = roomInfo.players.find((p) => p.seatIndex === i);
            return (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg ${
                  player ? 'bg-gray-700/60' : 'bg-gray-800/40 border border-dashed border-gray-700'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs text-gray-300 font-bold">
                  {i + 1}
                </span>
                {player ? (
                  <>
                    <span className="text-white font-medium flex-1">{player.name}</span>
                    {player.isHost && (
                      <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5 rounded-full font-medium">
                        Host
                      </span>
                    )}
                    {!player.isConnected && (
                      <span className="text-xs text-red-400">Disconnected</span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-500 text-sm">Empty seat</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {isHost ? (
            <button
              onClick={startGame}
              disabled={!canStart}
              className={`w-full py-3 rounded-xl font-bold text-xl transition-colors ${
                canStart
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {canStart ? 'Start Game' : 'Waiting for players...'}
            </button>
          ) : (
            <div className="text-center text-gray-400 py-3">
              Waiting for host to start...
            </div>
          )}
          <button
            onClick={leaveRoom}
            className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl font-medium transition-colors"
          >
            Leave Table
          </button>
        </div>
      </div>
    </div>
  );
}
