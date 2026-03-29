'use client';

import { useMultiplayerStore } from '@/store/multiplayer-store';
import { Phase } from '@/engine/types';

export default function MultiplayerWinnerBanner() {
  const gameState = useMultiplayerStore((s) => s.gameState);
  const mySocketId = useMultiplayerStore((s) => s.mySocketId);
  const roomInfo = useMultiplayerStore((s) => s.roomInfo);
  const nextHand = useMultiplayerStore((s) => s.nextHand);

  if (!gameState || gameState.phase !== Phase.Settle) return null;

  const isHost = roomInfo?.players.find((p) => p.id === mySocketId)?.isHost ?? false;

  return (
    <div className="absolute bottom-8 right-4 bg-gray-900/90 backdrop-blur-sm rounded-xl p-4 max-w-xs">
      {gameState.winners.map((w, i) => {
        const player = gameState.players.find((p) => p.id === w.playerId);
        return (
          <div key={i} className="mb-2 last:mb-0">
            <p className="text-green-400 font-bold">
              {player?.name} wins ${w.amount}
            </p>
            <p className="text-gray-400 text-sm">{w.handName}</p>
          </div>
        );
      })}

      {isHost ? (
        <button
          onClick={nextHand}
          className="mt-3 w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors"
        >
          Next Hand
        </button>
      ) : (
        <p className="mt-3 text-gray-400 text-sm text-center">
          Waiting for host...
        </p>
      )}
    </div>
  );
}
