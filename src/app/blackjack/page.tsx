'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useBlackjackStore } from '@/store/blackjack-store';
import BlackjackActionBar from '@/ui/BlackjackActionBar';
import BlackjackHUD from '@/ui/BlackjackHUD';
import BlackjackBetScreen from '@/ui/BlackjackBetScreen';

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
    }
  }, [state, router, hydrated]);

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
        <BlackjackCanvas />
        <div className="absolute inset-0 pointer-events-none">
          <div className="pointer-events-auto">
            <BlackjackHUD />
          </div>
          <div className="pointer-events-auto">
            <BlackjackActionBar />
          </div>
          <div className="pointer-events-auto">
            <BlackjackBetScreen />
          </div>
        </div>
        <button
          onClick={() => router.push('/')}
          className="absolute top-4 right-4 px-4 py-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors backdrop-blur-sm"
        >
          Menu
        </button>
      </div>
    </div>
  );
}
