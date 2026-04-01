'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/store/game-store';
import { useBlackjackStore } from '@/store/blackjack-store';
import { GameConfig, PokerVariant } from '@/engine/types';
import { BJConfig } from '@/blackjack/types';

type GameType = 'poker' | 'blackjack';

const VARIANT_LABELS: Record<PokerVariant, string> = {
  [PokerVariant.TexasHoldem]: "Texas Hold'em",
  [PokerVariant.Omaha]: 'Omaha',
  [PokerVariant.FiveCardDraw]: '5-Card Draw',
  [PokerVariant.TripleDraw27]: '2-7 Triple Draw',
  [PokerVariant.Razz]: 'Razz',
};

export default function MainMenu() {
  const router = useRouter();
  const initGame = useGameStore((s) => s.initGame);
  const savedPokerState = useGameStore((s) => s.state);
  const initBlackjack = useBlackjackStore((s) => s.initGame);
  const savedBJState = useBlackjackStore((s) => s.state);

  const [gameType, setGameType] = useState<GameType>('poker');
  const [variant, setVariant] = useState<PokerVariant>(PokerVariant.TexasHoldem);
  const [playerCount, setPlayerCount] = useState(5);
  const [startingChips, setStartingChips] = useState(5000);
  const [smallBlind, setSmallBlind] = useState(25);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');

  // Blackjack settings
  const [bjStartingChips, setBjStartingChips] = useState(1000);
  const [bjMinBet, setBjMinBet] = useState(10);
  const [bjDeckCount, setBjDeckCount] = useState(6);

  const handleStartPoker = () => {
    const config: GameConfig = {
      playerCount,
      startingChips,
      smallBlind,
      bigBlind: smallBlind * 2,
      aiDifficulty: difficulty,
      variant,
    };
    initGame(config);
    router.push('/game');
  };

  const handleStartBlackjack = () => {
    const config: BJConfig = {
      startingChips: bjStartingChips,
      minBet: bjMinBet,
      maxBet: bjStartingChips,
      deckCount: bjDeckCount,
    };
    initBlackjack(config);
    router.push('/blackjack');
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-green-950 flex justify-center overflow-y-auto">
      <div className="mt-5 bg-gray-800/80 rounded-2xl p-5 sm:p-8 max-w-md w-full mx-3 sm:mx-4 my-auto backdrop-blur-sm shrink-0">
        {/* Game Type Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setGameType('poker')}
            className={`flex-1 py-3 rounded-xl font-bold text-lg transition-colors ${
              gameType === 'poker'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            Poker
          </button>
          <button
            onClick={() => setGameType('blackjack')}
            className={`flex-1 py-3 rounded-xl font-bold text-lg transition-colors ${
              gameType === 'blackjack'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            Blackjack
          </button>
        </div>

        {/* Multiplayer Button */}
        <button
          onClick={() => router.push('/multiplayer')}
          className="w-full py-3 mb-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg transition-colors"
        >
          Multiplayer
        </button>

        {gameType === 'poker' ? (
          <>
            <h1 className="text-4xl font-bold text-center mb-2 text-white">
              {VARIANT_LABELS[variant]}
            </h1>
            <p className="text-center text-gray-400 mb-8">Poker</p>

            <div className="space-y-6">
              {/* Game Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Game Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(PokerVariant).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVariant(v)}
                      className={`py-2 px-2 rounded-lg font-bold text-sm transition-colors ${
                        variant === v
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {VARIANT_LABELS[v]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Player Count */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Opponents
                </label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5, 6, 7].map((n) => (
                    <button
                      key={n}
                      onClick={() => setPlayerCount(n)}
                      className={`flex-1 py-2 rounded-lg font-bold transition-colors ${
                        playerCount === n
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {n - 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Starting Chips */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Starting Chips
                </label>
                <div className="flex gap-2">
                  {[1000, 5000, 10000].map((n) => (
                    <button
                      key={n}
                      onClick={() => setStartingChips(n)}
                      className={`flex-1 py-2 rounded-lg font-bold transition-colors ${
                        startingChips === n
                          ? 'bg-yellow-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      ${n.toLocaleString('en-US')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Blinds */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Blinds
                </label>
                <div className="flex gap-2">
                  {[10, 25, 50].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSmallBlind(n)}
                      className={`flex-1 py-2 rounded-lg font-bold transition-colors ${
                        smallBlind === n
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {n}/{n * 2}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  AI Difficulty
                </label>
                <div className="flex gap-2">
                  {(['easy', 'medium', 'hard'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`flex-1 py-2 rounded-lg font-bold capitalize transition-colors ${
                        difficulty === d
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resume Poker */}
              {savedPokerState && savedPokerState.handNumber > 0 && (
                <button
                  onClick={() => router.push('/game')}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xl transition-colors mt-4"
                >
                  Resume Game
                </button>
              )}

              {/* Start Poker */}
              <button
                onClick={handleStartPoker}
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xl transition-colors mt-4"
              >
                New Game
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-bold text-center mb-2 text-white">
              Blackjack
            </h1>
            <p className="text-center text-gray-400 mb-8">Player vs Dealer</p>

            <div className="space-y-6">
              {/* Starting Chips */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Starting Chips
                </label>
                <div className="flex gap-2">
                  {[500, 1000, 5000].map((n) => (
                    <button
                      key={n}
                      onClick={() => setBjStartingChips(n)}
                      className={`flex-1 py-2 rounded-lg font-bold transition-colors ${
                        bjStartingChips === n
                          ? 'bg-yellow-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      ${n.toLocaleString('en-US')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Min Bet */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Minimum Bet
                </label>
                <div className="flex gap-2">
                  {[5, 10, 25].map((n) => (
                    <button
                      key={n}
                      onClick={() => setBjMinBet(n)}
                      className={`flex-1 py-2 rounded-lg font-bold transition-colors ${
                        bjMinBet === n
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      ${n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Deck Count */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Number of Decks
                </label>
                <div className="flex gap-2">
                  {[1, 2, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => setBjDeckCount(n)}
                      className={`flex-1 py-2 rounded-lg font-bold transition-colors ${
                        bjDeckCount === n
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resume Blackjack */}
              {savedBJState && savedBJState.roundNumber > 0 && savedBJState.chips > 0 && (
                <button
                  onClick={() => router.push('/blackjack')}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xl transition-colors mt-4"
                >
                  Resume Game
                </button>
              )}

              {/* Start Blackjack */}
              <button
                onClick={handleStartBlackjack}
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xl transition-colors mt-4"
              >
                New Game
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
