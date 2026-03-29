'use client';

import { useEffect, useState } from 'react';

export default function LandscapePrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const check = () => {
      const isMobile = window.innerWidth < 768;
      const isPortrait = window.innerHeight > window.innerWidth;
      setShow(isMobile && isPortrait);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center text-white gap-6 p-8">
      <div className="text-6xl animate-bounce">
        &#x1F4F1;
      </div>
      <div className="text-xl font-bold text-center">
        Tournez votre appareil en mode paysage
      </div>
      <div className="text-sm text-gray-400 text-center">
        Le jeu est optimis&eacute; pour le mode horizontal
      </div>
      <button
        onClick={() => setShow(false)}
        className="mt-4 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors"
      >
        Continuer quand m&ecirc;me
      </button>
    </div>
  );
}
