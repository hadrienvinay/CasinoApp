'use client';

import { useGameStore } from '@/store/game-store';
import { Phase, PokerVariant } from '@/engine/types';
import { getSeatPositions } from '@/lib/positions';

const PHASE_LABELS: Record<string, string> = {
  [Phase.Idle]: 'Waiting...',
  [Phase.Blinds]: 'Posting Blinds',
  [Phase.Deal]: 'Dealing',
  [Phase.PreFlop]: 'Pre-Flop',
  [Phase.Flop]: 'Flop',
  [Phase.Turn]: 'Turn',
  [Phase.River]: 'River',
  [Phase.Showdown]: 'Showdown',
  [Phase.Settle]: 'Hand Complete',
  [Phase.Draw1]: 'Draw 1',
  [Phase.Draw2]: 'Draw 2',
  [Phase.Draw3]: 'Draw 3',
};

// For non-community variants, Flop/Turn/River are betting rounds
const NON_COMMUNITY_PHASE_LABELS: Partial<Record<string, string>> = {
  [Phase.PreFlop]: 'Betting Round 1',
  [Phase.Flop]: 'Betting Round 2',
  [Phase.Turn]: 'Betting Round 3',
  [Phase.River]: 'Betting Round 4',
};

const VARIANT_LABELS: Record<PokerVariant, string> = {
  [PokerVariant.TexasHoldem]: "Texas Hold'em",
  [PokerVariant.Omaha]: 'Omaha',
  [PokerVariant.FiveCardDraw]: '5-Card Draw',
  [PokerVariant.TripleDraw27]: '2-7 Triple Draw',
  [PokerVariant.Razz]: 'Razz',
};

const NON_COMMUNITY_VARIANTS = new Set([
  PokerVariant.FiveCardDraw,
  PokerVariant.TripleDraw27,
  PokerVariant.Razz,
]);

export default function GameHUD() {
  const state = useGameStore((s) => s.state);
  const isAIThinking = useGameStore((s) => s.isAIThinking);

  if (!state) return null;

  const seats = getSeatPositions(state.players.length);
  const hasTopCenterPlayer = seats.some((s) => s.y < 150 && s.x > 400 && s.x < 880);

  const posClass = hasTopCenterPlayer
    ? 'absolute top-2 right-28 text-right'
    : 'absolute top-2 left-1/2 -translate-x-1/2 text-center';

  const variant = state.config.variant ?? PokerVariant.TexasHoldem;
  const isNonCommunity = NON_COMMUNITY_VARIANTS.has(variant);
  const phaseLabel = isNonCommunity
    ? (NON_COMMUNITY_PHASE_LABELS[state.phase] ?? PHASE_LABELS[state.phase] ?? state.phase)
    : (PHASE_LABELS[state.phase] ?? state.phase);

  return (
    <div className={`${posClass} bg-gray-900/80 rounded-lg px-3 py-2 sm:px-4 sm:py-3 backdrop-blur-sm text-white`}>
      <div className="text-[9px] sm:text-xs text-gray-500 mb-0.5">
        {VARIANT_LABELS[variant] ?? variant}
      </div>
      <div className="text-[10px] sm:text-sm text-gray-400">
        Hand #{state.handNumber} &middot; {state.config.smallBlind}/{state.config.bigBlind}
      </div>
      <div className="text-sm sm:text-lg font-bold text-yellow-400">
        {phaseLabel}
      </div>
      {isAIThinking && (
        <div className="text-[10px] sm:text-sm text-blue-400 animate-pulse mt-0.5">
          AI is thinking...
        </div>
      )}
    </div>
  );
}
