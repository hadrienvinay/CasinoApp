'use client';

import { useBlackjackStore } from '@/store/blackjack-store';
import { BJPhase } from '@/blackjack/types';

export default function BlackjackActionBar() {
  const state = useBlackjackStore((s) => s.state);
  const isAnimating = useBlackjackStore((s) => s.isAnimating);
  const doHit = useBlackjackStore((s) => s.doHit);
  const doStand = useBlackjackStore((s) => s.doStand);
  const doDoubleDown = useBlackjackStore((s) => s.doDoubleDown);
  const doSplit = useBlackjackStore((s) => s.doSplit);
  const canSplit = useBlackjackStore((s) => s.canPlayerSplit);
  const canDouble = useBlackjackStore((s) => s.canPlayerDouble);

  if (!state || state.phase !== BJPhase.PlayerTurn || isAnimating) return null;

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 flex gap-2 sm:gap-3">
      <button
        onClick={doHit}
        className="px-6 py-3 sm:px-8 bg-green-600 active:bg-green-800 hover:bg-green-700 text-white rounded-xl font-bold text-base sm:text-lg transition-colors shadow-lg min-h-[48px]"
      >
        Hit
      </button>
      <button
        onClick={doStand}
        className="px-6 py-3 sm:px-8 bg-blue-600 active:bg-blue-800 hover:bg-blue-700 text-white rounded-xl font-bold text-base sm:text-lg transition-colors shadow-lg min-h-[48px]"
      >
        Stand
      </button>
      {canDouble() && (
        <button
          onClick={doDoubleDown}
          className="px-4 py-3 sm:px-6 bg-yellow-600 active:bg-yellow-800 hover:bg-yellow-700 text-white rounded-xl font-bold text-base sm:text-lg transition-colors shadow-lg min-h-[48px]"
        >
          Double
        </button>
      )}
      {canSplit() && (
        <button
          onClick={doSplit}
          className="px-4 py-3 sm:px-6 bg-purple-600 active:bg-purple-800 hover:bg-purple-700 text-white rounded-xl font-bold text-base sm:text-lg transition-colors shadow-lg min-h-[48px]"
        >
          Split
        </button>
      )}
    </div>
  );
}
