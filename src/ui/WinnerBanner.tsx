'use client';

import { useGameStore } from '@/store/game-store';
import { Phase } from '@/engine/types';

export default function WinnerBanner() {
  const state = useGameStore((s) => s.state);
  const newHand = useGameStore((s) => s.newHand);

  if (!state || state.phase !== Phase.Settle) return null;

  const humanPlayer = state.players.find((p) => p.isHuman);
  const humanBusted = !humanPlayer || humanPlayer.chips <= 0;
  const activePlayers = state.players.filter((p) => p.chips > 0);
  const gameOver = humanBusted || activePlayers.length <= 1;

  return (
    <div className="absolute bottom-8 right-4 flex flex-col gap-3 pointer-events-auto">
      {/* Winner info */}
      <div className="bg-gray-900/90 rounded-xl px-5 py-4 backdrop-blur-sm text-center min-w-[160px]">
        <div className="text-sm text-gray-400 mb-2">
          {humanBusted ? 'You are eliminated!' : gameOver ? 'You win!' : 'Winner'}
        </div>
        {state.winners.map((w) => {
          const player = state.players.find((p) => p.id === w.playerId);
          return (
            <div key={w.playerId} className="mb-1">
              <div className="text-white font-bold">{player?.name}</div>
              <div className="text-green-400 font-bold text-lg">+${w.amount}</div>
              <div className="text-yellow-300 text-xs">{w.handName}</div>
            </div>
          );
        })}
      </div>

      {/* Action button */}
      {!gameOver ? (
        <button
          onClick={newHand}
          className="px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-base transition-colors shadow-lg"
        >
          Next Hand
        </button>
      ) : (
        <button
          onClick={() => window.location.href = '/'}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base transition-colors shadow-lg"
        >
          Back to Menu
        </button>
      )}
    </div>
  );
}
