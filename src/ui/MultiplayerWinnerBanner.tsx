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
    <div className="fixed bottom-3 right-2 sm:bottom-8 sm:right-4 bg-gray-900/90 backdrop-blur-sm rounded-xl p-3 sm:p-4 max-w-xs z-20">
      {gameState.winners.map((w, i) => {
        const player = gameState.players.find((p) => p.id === w.playerId);
        return (
          <div key={i} className="mb-2 last:mb-0">
            <p className="text-green-400 font-bold text-sm sm:text-base">
              {player?.name} wins ${w.amount}
            </p>
            <p className="text-gray-400 text-xs sm:text-sm">{w.handName}</p>
          </div>
        );
      })}

      {isHost ? (
        <button
          onClick={nextHand}
          className="mt-2 sm:mt-3 w-full py-2.5 bg-green-600 active:bg-green-800 hover:bg-green-700 text-white rounded-lg font-bold text-sm sm:text-base transition-colors min-h-[44px]"
        >
          Next Hand
        </button>
      ) : (
        <p className="mt-2 sm:mt-3 text-gray-400 text-xs sm:text-sm text-center">
          Waiting for host...
        </p>
      )}
    </div>
  );
}
