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

const VARIANT_LABELS: Record<PokerVariant, string> = {
  [PokerVariant.TexasHoldem]: "Texas Hold'em",
  [PokerVariant.Omaha]: 'Omaha',
  [PokerVariant.FiveCardDraw]: '5-Card Draw',
  [PokerVariant.TripleDraw27]: '2-7 Triple Draw',
  [PokerVariant.Razz]: 'Razz',
};

export default function GameHUD() {
  const state = useGameStore((s) => s.state);
  const isAIThinking = useGameStore((s) => s.isAIThinking);

  if (!state) return null;

  // Check if any player sits near the top center (would overlap with centered HUD)
  const seats = getSeatPositions(state.players.length);
  const hasTopCenterPlayer = seats.some((s) => s.y < 150 && s.x > 400 && s.x < 880);

  const posClass = hasTopCenterPlayer
    ? 'absolute top-4 right-28 text-right'
    : 'absolute top-4 left-1/2 -translate-x-1/2 text-center';

  return (
    <div className={`${posClass} bg-gray-900/80 rounded-lg px-4 py-3 backdrop-blur-sm text-white`}>
      <div className="text-xs text-gray-500 mb-0.5">
        {VARIANT_LABELS[state.config.variant] ?? state.config.variant}
      </div>
      <div className="text-sm text-gray-400">
        Hand #{state.handNumber} &middot; Blinds {state.config.smallBlind}/{state.config.bigBlind}
      </div>
      <div className="text-lg font-bold text-yellow-400">
        {PHASE_LABELS[state.phase] ?? state.phase}
      </div>
      {isAIThinking && (
        <div className="text-sm text-blue-400 animate-pulse mt-1">
          AI is thinking...
        </div>
      )}
    </div>
  );
}
