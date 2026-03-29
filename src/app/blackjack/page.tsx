'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useBlackjackStore } from '@/store/blackjack-store';
import BlackjackActionBar from '@/ui/BlackjackActionBar';
import BlackjackHUD from '@/ui/BlackjackHUD';
import BlackjackBetScreen from '@/ui/BlackjackBetScreen';
import LandscapePrompt from '@/ui/LandscapePrompt';

const BlackjackCanvas = dynamic(() => import('@/pixi/BlackjackCanvas'), { ssr: false });

const BASE_W = 1280;
const BASE_H = 720;

export default function BlackjackPage() {
  const router = useRouter();
  const state = useBlackjackStore((s) => s.state);
  const [scale, setScale] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = useBlackjackStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    if (useBlackjackStore.persist.hasHydrated()) {
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
    }
  }, [state, router, hydrated]);

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
        <BlackjackCanvas />
      </div>

      {/* Interactive UI — outside scaled container */}
      <div className="fixed inset-0 pointer-events-none z-10">
        <div className="pointer-events-auto">
          <BlackjackHUD />
        </div>
        <div className="pointer-events-auto">
          <BlackjackActionBar />
        </div>
        <div className="pointer-events-auto">
          <BlackjackBetScreen />
        </div>
        <button
          onClick={() => router.push('/')}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 px-3 py-2 sm:px-4 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors backdrop-blur-sm pointer-events-auto min-h-[36px]"
        >
          Menu
        </button>
      </div>

      <LandscapePrompt />
    </div>
  );
}
