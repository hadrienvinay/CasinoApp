'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/game-store';
import { Phase } from '@/engine/types';
import { playDefeat, playCon } from '@/lib/sounds';

export default function WinnerBanner() {
  const state = useGameStore((s) => s.state);
  const newHand = useGameStore((s) => s.newHand);
  const playedRef = useRef(false);

  const humanPlayer = state?.players.find((p) => p.isHuman);
  const humanBusted = !humanPlayer || humanPlayer.chips <= 0;
  const activePlayers = state?.players.filter((p) => p.chips > 0) ?? [];
  const gameOver = humanBusted || activePlayers.length <= 1;

  // Play sounds once per Settle phase
  useEffect(() => {
    if (!state || state.phase !== Phase.Settle) {
      playedRef.current = false;
      return;
    }
    if (playedRef.current) return;
    playedRef.current = true;

    if (humanBusted) {
      // Human is eliminated
      playDefeat();
    } else {
      // Check if human won an all-in that knocked out an opponent
      const humanWon = state.winners.some((w) => {
        const p = state.players.find((pl) => pl.id === w.playerId);
        return p?.isHuman;
      });
      const opponentEliminated = state.players.some(
        (p) => !p.isHuman && p.chips <= 0,
      );
      if (humanWon && opponentEliminated) {
        playCon();
      }
    }
  }, [state, humanBusted]);

  if (!state || state.phase !== Phase.Settle) return null;

  return (
    <div className="fixed bottom-3 right-2 sm:bottom-8 sm:right-4 flex flex-col gap-2 sm:gap-3 pointer-events-auto z-20">
      {/* Winner info */}
      <div className="bg-gray-900/90 rounded-xl px-4 py-3 sm:px-5 sm:py-4 backdrop-blur-sm text-center min-w-[140px] sm:min-w-[160px]">
        <div className="text-xs sm:text-sm text-gray-400 mb-1.5 sm:mb-2">
          {humanBusted ? 'You are eliminated!' : gameOver ? 'You win!' : 'Winner'}
        </div>
        {state.winners.map((w) => {
          const player = state.players.find((p) => p.id === w.playerId);
          return (
            <div key={w.playerId} className="mb-1">
              <div className="text-white font-bold text-sm sm:text-base">{player?.name}</div>
              <div className="text-green-400 font-bold text-base sm:text-lg">+${w.amount}</div>
              <div className="text-yellow-300 text-[10px] sm:text-xs">{w.handName}</div>
            </div>
          );
        })}
      </div>

      {/* Action button */}
      {!gameOver ? (
        <button
          onClick={newHand}
          className="px-4 py-3 sm:px-5 bg-green-600 active:bg-green-800 hover:bg-green-700 text-white rounded-xl font-bold text-sm sm:text-base transition-colors shadow-lg min-h-[44px]"
        >
          Next Hand
        </button>
      ) : (
        <button
          onClick={() => window.location.href = '/'}
          className="px-4 py-3 sm:px-5 bg-blue-600 active:bg-blue-800 hover:bg-blue-700 text-white rounded-xl font-bold text-sm sm:text-base transition-colors shadow-lg min-h-[44px]"
        >
          Back to Menu
        </button>
      )}
    </div>
  );
}
