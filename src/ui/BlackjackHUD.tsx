'use client';

import { useBlackjackStore } from '@/store/blackjack-store';

export default function BlackjackHUD() {
  const state = useBlackjackStore((s) => s.state);

  if (!state) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 sm:top-4 bg-gray-900/80 backdrop-blur-sm rounded-xl px-4 py-2 sm:px-6 sm:py-3 flex gap-5 sm:gap-8 items-center z-10">
      <div className="text-center">
        <div className="text-[9px] sm:text-xs text-gray-400 uppercase tracking-wider">Round</div>
        <div className="text-sm sm:text-lg font-bold text-white">{state.roundNumber}</div>
      </div>
      <div className="text-center">
        <div className="text-[9px] sm:text-xs text-gray-400 uppercase tracking-wider">Chips</div>
        <div className="text-sm sm:text-lg font-bold text-yellow-400">${state.chips.toLocaleString()}</div>
      </div>
      <div className="text-center">
        <div className="text-[9px] sm:text-xs text-gray-400 uppercase tracking-wider">Bet</div>
        <div className="text-sm sm:text-lg font-bold text-green-400">
          ${state.playerHands.length > 0
            ? state.playerHands.reduce((sum, h) => sum + h.bet, 0)
            : state.currentBet}
        </div>
      </div>
    </div>
  );
}
