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
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
      <button
        onClick={doHit}
        className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg transition-colors shadow-lg"
      >
        Hit
      </button>
      <button
        onClick={doStand}
        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg transition-colors shadow-lg"
      >
        Stand
      </button>
      {canDouble() && (
        <button
          onClick={doDoubleDown}
          className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-bold text-lg transition-colors shadow-lg"
        >
          Double
        </button>
      )}
      {canSplit() && (
        <button
          onClick={doSplit}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-lg transition-colors shadow-lg"
        >
          Split
        </button>
      )}
    </div>
  );
}
