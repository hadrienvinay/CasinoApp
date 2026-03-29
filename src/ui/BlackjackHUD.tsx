'use client';

import { useBlackjackStore } from '@/store/blackjack-store';

export default function BlackjackHUD() {
  const state = useBlackjackStore((s) => s.state);

  if (!state) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-sm rounded-xl px-6 py-3 flex gap-8 items-center">
      <div className="text-center">
        <div className="text-xs text-gray-400 uppercase tracking-wider">Round</div>
        <div className="text-lg font-bold text-white">{state.roundNumber}</div>
      </div>
      <div className="text-center">
        <div className="text-xs text-gray-400 uppercase tracking-wider">Chips</div>
        <div className="text-lg font-bold text-yellow-400">${state.chips.toLocaleString()}</div>
      </div>
      <div className="text-center">
        <div className="text-xs text-gray-400 uppercase tracking-wider">Bet</div>
        <div className="text-lg font-bold text-green-400">
          ${state.playerHands.length > 0
            ? state.playerHands.reduce((sum, h) => sum + h.bet, 0)
            : state.currentBet}
        </div>
      </div>
    </div>
  );
}
