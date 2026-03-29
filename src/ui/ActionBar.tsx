'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/game-store';
import { ActionType, PlayerAction, Phase, PokerVariant, Suit } from '@/engine/types';

const DRAW_PHASES = new Set([Phase.Draw1, Phase.Draw2, Phase.Draw3]);
const DRAW_VARIANTS = new Set([PokerVariant.FiveCardDraw, PokerVariant.TripleDraw27]);

const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.Hearts]: '\u2665',
  [Suit.Diamonds]: '\u2666',
  [Suit.Clubs]: '\u2663',
  [Suit.Spades]: '\u2660',
};

const SUIT_COLORS: Record<Suit, string> = {
  [Suit.Hearts]: 'text-red-500',
  [Suit.Diamonds]: 'text-red-500',
  [Suit.Clubs]: 'text-white',
  [Suit.Spades]: 'text-white',
};

export default function ActionBar() {
  const state = useGameStore((s) => s.state);
  const isAnimating = useGameStore((s) => s.isAnimating);
  const isAIThinking = useGameStore((s) => s.isAIThinking);
  const submitAction = useGameStore((s) => s.submitAction);
  const submitDraw = useGameStore((s) => s.submitDraw);
  const isHumanTurnFn = useGameStore((s) => s.isHumanTurn);
  const getAvailableActionsFn = useGameStore((s) => s.getAvailableActions);

  const isHumanTurn = isHumanTurnFn();
  const availableActions = getAvailableActionsFn();

  const [raiseAmount, setRaiseAmount] = useState(0);
  const [selectedDiscards, setSelectedDiscards] = useState<Set<number>>(new Set());

  if (!state || !isHumanTurn || isAnimating || isAIThinking) return null;

  const player = state.players[state.activePlayerIndex];

  // Don't show actions when the player is all-in
  if (player.isAllIn) return null;
  const isDrawPhase = DRAW_PHASES.has(state.phase);
  const isDrawVariant = DRAW_VARIANTS.has(state.config.variant);

  // Draw phase UI for draw game variants
  if (isDrawPhase && isDrawVariant && player.holeCards) {
    const toggleDiscard = (index: number) => {
      setSelectedDiscards((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        return next;
      });
    };

    const handleDraw = () => {
      submitDraw(Array.from(selectedDiscards).sort());
      setSelectedDiscards(new Set());
    };

    const handleStandPat = () => {
      submitDraw([]);
      setSelectedDiscards(new Set());
    };

    return (
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 sm:gap-3 bg-gray-900/90 rounded-xl px-4 py-3 sm:px-6 sm:py-4 backdrop-blur-sm max-w-[95vw]">
        <div className="text-xs sm:text-sm font-medium text-gray-300">
          Select cards to discard
        </div>
        <div className="flex gap-1.5 sm:gap-2">
          {player.holeCards.map((card, i) => (
            <button
              key={i}
              onClick={() => toggleDiscard(i)}
              className={`w-11 h-16 sm:w-14 sm:h-20 rounded-lg border-2 flex flex-col items-center justify-center font-bold text-base sm:text-lg transition-colors ${
                selectedDiscards.has(i)
                  ? 'border-red-500 bg-red-900/60'
                  : 'border-gray-600 bg-gray-800 hover:border-gray-400'
              }`}
            >
              <span className={SUIT_COLORS[card.suit]}>
                {card.rank}
              </span>
              <span className={`text-xs sm:text-sm ${SUIT_COLORS[card.suit]}`}>
                {SUIT_SYMBOLS[card.suit]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={handleStandPat}
            className="px-4 py-2.5 sm:px-5 sm:py-2.5 bg-green-600 active:bg-green-800 hover:bg-green-700 text-white rounded-lg font-bold text-sm sm:text-base transition-colors min-h-[44px]"
          >
            Stand Pat
          </button>
          <button
            onClick={handleDraw}
            className="px-4 py-2.5 sm:px-5 sm:py-2.5 bg-yellow-600 active:bg-yellow-800 hover:bg-yellow-700 text-white rounded-lg font-bold text-sm sm:text-base transition-colors min-h-[44px]"
          >
            Draw {selectedDiscards.size > 0 ? selectedDiscards.size : ''}
          </button>
        </div>
      </div>
    );
  }

  // Normal betting UI
  const toCall = state.currentBet - player.currentBet;
  const minRaise = state.minRaise + state.currentBet - player.currentBet;
  const maxRaise = player.chips;

  const hasCheck = availableActions.some((a) => a.type === ActionType.Check);
  const hasCall = availableActions.some((a) => a.type === ActionType.Call);
  const hasRaise = availableActions.some((a) => a.type === ActionType.Raise);

  const handleAction = (action: PlayerAction) => {
    submitAction(action);
    setRaiseAmount(0);
  };

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 sm:gap-3 bg-gray-900/90 rounded-xl px-3 py-3 sm:px-6 sm:py-4 backdrop-blur-sm max-w-[95vw]">
      {/* Fold */}
      <button
        onClick={() => handleAction({ type: ActionType.Fold, amount: 0 })}
        className="px-4 py-2.5 sm:px-5 bg-red-600 active:bg-red-800 hover:bg-red-700 text-white rounded-lg font-bold text-sm sm:text-base transition-colors min-h-[44px]"
      >
        Fold
      </button>

      {/* Check */}
      {hasCheck && (
        <button
          onClick={() => handleAction({ type: ActionType.Check, amount: 0 })}
          className="px-4 py-2.5 sm:px-5 bg-green-600 active:bg-green-800 hover:bg-green-700 text-white rounded-lg font-bold text-sm sm:text-base transition-colors min-h-[44px]"
        >
          Check
        </button>
      )}

      {/* Call */}
      {hasCall && (
        <button
          onClick={() => handleAction({ type: ActionType.Call, amount: toCall })}
          className="px-4 py-2.5 sm:px-5 bg-blue-600 active:bg-blue-800 hover:bg-blue-700 text-white rounded-lg font-bold text-sm sm:text-base transition-colors min-h-[44px]"
        >
          Call ${toCall}
        </button>
      )}

      {/* Raise */}
      {hasRaise && (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setRaiseAmount((prev) => Math.max(minRaise, (prev || minRaise) - state.config.bigBlind))}
            className="w-9 h-9 sm:w-8 sm:h-8 bg-gray-700 active:bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-bold text-lg transition-colors flex items-center justify-center min-h-[36px]"
          >
            -
          </button>
          <input
            type="range"
            min={minRaise}
            max={maxRaise}
            step={state.config.bigBlind}
            value={raiseAmount || minRaise}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            className="w-20 sm:w-24 accent-yellow-500 h-6"
          />
          <button
            onClick={() => setRaiseAmount((prev) => Math.min(maxRaise, (prev || minRaise) + state.config.bigBlind))}
            className="w-9 h-9 sm:w-8 sm:h-8 bg-gray-700 active:bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-bold text-lg transition-colors flex items-center justify-center min-h-[36px]"
          >
            +
          </button>
          <button
            onClick={() => handleAction({ type: ActionType.Raise, amount: raiseAmount || minRaise })}
            className="px-3 py-2.5 sm:px-5 bg-yellow-600 active:bg-yellow-800 hover:bg-yellow-700 text-white rounded-lg font-bold text-sm sm:text-base transition-colors min-h-[44px]"
          >
            Raise ${raiseAmount || minRaise}
          </button>
        </div>
      )}

      {/* All-In */}
      <button
        onClick={() => handleAction({ type: ActionType.AllIn, amount: player.chips })}
        className="px-4 py-2.5 sm:px-5 bg-purple-600 active:bg-purple-800 hover:bg-purple-700 text-white rounded-lg font-bold text-sm sm:text-base transition-colors min-h-[44px]"
      >
        All-In ${player.chips}
      </button>
    </div>
  );
}
