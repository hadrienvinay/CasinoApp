'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBlackjackStore } from '@/store/blackjack-store';
import { BJPhase } from '@/blackjack/types';

export default function BlackjackBetScreen() {
  const router = useRouter();
  const state = useBlackjackStore((s) => s.state);
  const isAnimating = useBlackjackStore((s) => s.isAnimating);
  const doBet = useBlackjackStore((s) => s.doBet);
  const doDeal = useBlackjackStore((s) => s.doDeal);
  const startNextRound = useBlackjackStore((s) => s.startNextRound);
  const [betAmount, setBetAmount] = useState(25);

  if (!state) return null;

  // Betting phase
  if (state.phase === BJPhase.Betting) {
    const presets = [10, 25, 50, 100];
    const maxBet = Math.min(state.config.maxBet, state.chips);

    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-20">
        <div className="bg-gray-800/95 backdrop-blur-sm rounded-2xl p-6 sm:p-8 max-w-sm w-full mx-4 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Place Your Bet</h2>
          <p className="text-gray-400 text-sm sm:text-base mb-4 sm:mb-6">Chips: ${state.chips.toLocaleString()}</p>

          <div className="flex gap-2 justify-center mb-4">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setBetAmount(Math.min(p, maxBet))}
                disabled={p > state.chips}
                className={`px-3 py-2.5 sm:px-4 rounded-lg font-bold text-sm sm:text-base transition-colors min-h-[44px] ${
                  betAmount === p
                    ? 'bg-yellow-600 text-white'
                    : p > state.chips
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                ${p}
              </button>
            ))}
          </div>

          <input
            type="range"
            min={state.config.minBet}
            max={maxBet}
            step={5}
            value={betAmount}
            onChange={(e) => setBetAmount(Number(e.target.value))}
            className="w-full mb-2 h-6"
          />
          <p className="text-white font-bold text-lg sm:text-xl mb-4 sm:mb-6">${betAmount}</p>

          <button
            onClick={() => {
              doBet(betAmount);
              setTimeout(() => doDeal(), 300);
            }}
            className="w-full py-3 bg-green-600 active:bg-green-800 hover:bg-green-700 text-white rounded-xl font-bold text-lg sm:text-xl transition-colors min-h-[48px]"
          >
            Deal
          </button>
        </div>
      </div>
    );
  }

  // Settle phase
  if (state.phase === BJPhase.Settle && !isAnimating) {
    const isGameOver = state.chips <= 0;

    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-20">
        <div className="bg-gray-800/95 backdrop-blur-sm rounded-2xl p-6 sm:p-8 max-w-sm w-full mx-4 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">{state.message}</h2>

          {isGameOver ? (
            <>
              <p className="text-red-400 text-base sm:text-lg mb-4 sm:mb-6">No chips remaining!</p>
              <button
                onClick={() => router.push('/')}
                className="w-full py-3 bg-red-600 active:bg-red-800 hover:bg-red-700 text-white rounded-xl font-bold text-lg sm:text-xl transition-colors min-h-[48px]"
              >
                Back to Menu
              </button>
            </>
          ) : (
            <button
              onClick={startNextRound}
              className="w-full py-3 bg-green-600 active:bg-green-800 hover:bg-green-700 text-white rounded-xl font-bold text-lg sm:text-xl transition-colors min-h-[48px]"
            >
              Next Round
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
