'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useGameStore } from '@/store/game-store';
import ActionBar from '@/ui/ActionBar';
import GameHUD from '@/ui/GameHUD';
import WinnerBanner from '@/ui/WinnerBanner';
import HandHistory from '@/ui/HandHistory';
import LandscapePrompt from '@/ui/LandscapePrompt';

const PokerCanvas = dynamic(() => import('@/pixi/PokerCanvas'), { ssr: false });

const BASE_W = 1280;
const BASE_H = 720;

export default function GamePage() {
  const router = useRouter();
  const state = useGameStore((s) => s.state);
  const newHand = useGameStore((s) => s.newHand);
  const showOpponentHands = useGameStore((s) => s.showOpponentHands);
  const toggleShowOpponentHands = useGameStore((s) => s.toggleShowOpponentHands);
  const showStackInBlinds = useGameStore((s) => s.showStackInBlinds);
  const toggleShowStackInBlinds = useGameStore((s) => s.toggleShowStackInBlinds);
  const [scale, setScale] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = useGameStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    if (useGameStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, []);

  const updateScale = useCallback(() => {
    const scaleX = window.innerWidth / BASE_W;
    const scaleY = window.innerHeight / BASE_H;
    setScale(Math.min(scaleX, scaleY));
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale]);

  useEffect(() => {
    if (!hydrated) return;
    if (!state) {
      router.push('/');
      return;
    }
    if (state.handNumber === 0) {
      newHand();
    }
  }, [state, newHand, router, hydrated]);

  if (!hydrated || !state) return null;

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      {/* Scaled canvas container */}
      <div
        className="relative"
        style={{
          width: BASE_W,
          height: BASE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <PokerCanvas />
        {/* HUD stays inside scaled container (non-interactive info) */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="pointer-events-auto">
            <GameHUD />
          </div>
        </div>
      </div>

      {/* Interactive UI — outside scaled container, full viewport positioning */}
      <div className="fixed inset-0 pointer-events-none z-10">
        {/* Top controls */}
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex gap-1.5 sm:gap-2 pointer-events-auto">
          <button
            onClick={toggleShowStackInBlinds}
            className={`px-2.5 py-2 sm:px-3 rounded-lg text-xs font-medium transition-colors backdrop-blur-sm ${
              showStackInBlinds
                ? 'bg-blue-600/80 hover:bg-blue-500 text-white'
                : 'bg-gray-800/80 hover:bg-gray-700 text-gray-300'
            }`}
            title="Afficher en BB / $"
          >
            {showStackInBlinds ? 'BB' : '$'}
          </button>
          <button
            onClick={toggleShowOpponentHands}
            className={`px-2.5 py-2 sm:px-3 rounded-lg text-xs font-medium transition-colors backdrop-blur-sm ${
              showOpponentHands
                ? 'bg-amber-600/80 hover:bg-amber-500 text-white'
                : 'bg-gray-800/80 hover:bg-gray-700 text-gray-300'
            }`}
            title="Voir les mains adverses (debug)"
          >
            {showOpponentHands ? '👁' : '👁‍🗨'}
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-3 py-2 sm:px-4 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors backdrop-blur-sm"
          >
            Menu
          </button>
        </div>

        {/* Hand history */}
        <div className="pointer-events-auto">
          <HandHistory />
        </div>

        {/* Action bar */}
        <div className="pointer-events-auto">
          <ActionBar />
        </div>

        {/* Winner banner */}
        <div className="pointer-events-auto">
          <WinnerBanner />
        </div>
      </div>

      <LandscapePrompt />
    </div>
  );
}
