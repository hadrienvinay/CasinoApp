'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/game-store';

export default function HandHistory() {
  const handHistory = useGameStore((s) => s.handHistory);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(() => {
    // Auto-collapse on small screens
    if (typeof window !== 'undefined') return window.innerWidth < 768;
    return false;
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [handHistory]);

  if (!handHistory || handHistory.length === 0) return null;

  return (
    <div className="fixed top-2 left-2 sm:top-4 sm:left-4 flex flex-col pointer-events-auto z-10">
      <div className="bg-gray-900/85 rounded-lg backdrop-blur-sm flex flex-col overflow-hidden"
        style={{ width: collapsed ? 'auto' : 200 }}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50 hover:bg-gray-800/60 transition-colors cursor-pointer min-h-[36px]"
        >
          <h3 className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
            History
          </h3>
          <span className="text-gray-500 text-xs ml-2">
            {collapsed ? '+' : '\u2212'}
          </span>
        </button>
        {!collapsed && (
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-2 sm:px-3 py-2 space-y-0.5 scrollbar-thin"
            style={{ maxHeight: 'min(calc(100vh - 200px), 300px)' }}
          >
            {handHistory.map((entry, i) => (
              <div
                key={i}
                className={`text-[10px] sm:text-xs leading-relaxed ${
                  entry.startsWith('---')
                    ? 'text-gray-500 font-bold mt-2 mb-1'
                    : entry.startsWith('*')
                      ? 'text-yellow-400 font-semibold'
                      : 'text-gray-300'
                }`}
              >
                {entry}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
