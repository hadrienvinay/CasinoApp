'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMultiplayerStore } from '@/store/multiplayer-store';
import { Phase } from '@/engine/types';

export default function MultiplayerWinnerBanner() {
  const router = useRouter();
  const gameState = useMultiplayerStore((s) => s.gameState);
  const mySocketId = useMultiplayerStore((s) => s.mySocketId);
  const roomInfo = useMultiplayerStore((s) => s.roomInfo);
  const rebuy = useMultiplayerStore((s) => s.rebuy);
  const leaveRoom = useMultiplayerStore((s) => s.leaveRoom);

  const isSettle = gameState?.phase === Phase.Settle;

  // Countdown timer for next hand
  const [countdown, setCountdown] = useState(4);
  useEffect(() => {
    if (!isSettle) {
      setCountdown(4);
      return;
    }
    const interval = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isSettle]);

  if (!gameState || !isSettle) return null;

  const myPlayer = gameState.players.find((p) => p.id === mySocketId);
  const isBusted = myPlayer !== undefined && myPlayer.chips <= 0;
  const startingChips = roomInfo?.config.startingChips ?? 0;

  // Rebuy modal — full-screen overlay for the busted player
  if (isBusted) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-30">
        <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 max-w-sm w-full mx-4 text-center shadow-2xl border border-gray-700">
          <div className="text-4xl mb-3">💸</div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Tapis !</h2>
          <p className="text-gray-400 text-sm sm:text-base mb-6">
            Tu n&apos;as plus de jetons. Veux-tu recaver ?
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={rebuy}
              className="w-full py-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-xl font-bold text-base sm:text-lg transition-colors min-h-[48px]"
            >
              Recaver (${startingChips})
            </button>
            <button
              onClick={() => {
                leaveRoom();
                router.push('/');
              }}
              className="w-full py-3 bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-white rounded-xl font-bold text-base sm:text-lg transition-colors min-h-[48px]"
            >
              Quitter la partie
            </button>
          </div>
        </div>
      </div>
    );
  }

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

      <p className="mt-2 text-gray-500 text-xs text-center">
        Prochaine main dans {countdown}s...
      </p>
    </div>
  );
}
