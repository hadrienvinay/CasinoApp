'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useGameStore } from '@/store/game-store';
import ActionBar from '@/ui/ActionBar';
import GameHUD from '@/ui/GameHUD';
import WinnerBanner from '@/ui/WinnerBanner';
import HandHistory from '@/ui/HandHistory';

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
    // Wait for zustand persist to hydrate from localStorage
    const unsub = useGameStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    // If already hydrated (e.g. navigating back)
    if (useGameStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, []);

  const updateScale = useCallback(() => {
    const scaleX = window.innerWidth / BASE_W;
    const scaleY = window.innerHeight / BASE_H;
    setScale(Math.min(scaleX, scaleY, 1));
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
    <div className="min-h-screen bg-black flex items-center justify-center overflow-hidden">
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
        <div className="absolute inset-0 pointer-events-none">
          <div className="pointer-events-auto">
            <HandHistory />
          </div>
          <div className="pointer-events-auto">
            <GameHUD />
          </div>
          <div className="pointer-events-auto">
            <ActionBar />
          </div>
          <div className="pointer-events-auto">
            <WinnerBanner />
          </div>
        </div>
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={toggleShowStackInBlinds}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors backdrop-blur-sm ${
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
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors backdrop-blur-sm ${
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
            className="px-4 py-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors backdrop-blur-sm"
          >
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}
