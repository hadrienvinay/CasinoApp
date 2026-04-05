'use client';

import { useState, useMemo, useEffect } from 'react';
import { useMultiplayerStore } from '@/store/multiplayer-store';
import { ActionType, Phase } from '@/engine/types';

export default function MultiplayerActionBar() {
  const gameState = useMultiplayerStore((s) => s.gameState);
  const availableActions = useMultiplayerStore((s) => s.availableActions);
  const isMyTurn = useMultiplayerStore((s) => s.isMyTurn);
  const turnTimer = useMultiplayerStore((s) => s.turnTimer);
  const mySocketId = useMultiplayerStore((s) => s.mySocketId);
  const submitAction = useMultiplayerStore((s) => s.submitAction);

  const [raiseAmount, setRaiseAmount] = useState(0);

  const phase = gameState?.phase ?? null;
  useEffect(() => {
    setRaiseAmount(0);
  }, [isMyTurn, phase]);

  const actions = useMemo(() => {
    const map: Record<string, { type: ActionType; amount: number }> = {};
    for (const a of availableActions) {
      map[a.type] = { type: a.type, amount: a.amount };
    }
    return map;
  }, [availableActions]);

  if (!gameState) return null;
  if (gameState.phase === Phase.Settle || gameState.phase === Phase.Showdown) return null;
  if (gameState.allInRunout) return null;

  const timerSeconds = turnTimer ? Math.ceil(turnTimer.remainingMs / 1000) : null;
  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const myPlayer = gameState.players.find((p) => p.id === mySocketId);
  const myChips = myPlayer?.chips ?? 0;

  if (!isMyTurn) {
    return (
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-sm rounded-xl px-4 py-2.5 sm:px-6 sm:py-3 flex items-center gap-3 sm:gap-4">
        <span className="text-yellow-400 font-bold text-sm">${myChips}</span>
        <span className="text-gray-500">|</span>
        <span className="text-gray-400 text-sm sm:text-base">
          Waiting for <span className="text-white font-medium">{activePlayer?.name}</span>...
        </span>
        {timerSeconds !== null && (
          <span className={`font-mono font-bold text-base sm:text-lg ${timerSeconds <= 10 ? 'text-red-400' : 'text-yellow-400'}`}>
            {timerSeconds}s
          </span>
        )}
      </div>
    );
  }

  const bigBlind = gameState.config.bigBlind;
  const minRaise = actions[ActionType.Raise]?.amount ?? gameState.minRaise;
  const maxRaise = myPlayer ? myPlayer.chips : 0;
  const effectiveRaise = raiseAmount || minRaise;

  const toCall = gameState.currentBet - (myPlayer?.currentBet ?? 0);
  const isBet = gameState.currentBet === 0;

  // Pot-relative presets
  const pot = gameState.pot + toCall; // effective pot after calling
  const presets = [
    { label: '¼', amount: Math.max(minRaise, Math.floor(pot * 0.25)) },
    { label: '½', amount: Math.max(minRaise, Math.floor(pot * 0.5)) },
    { label: 'Pot', amount: Math.max(minRaise, pot) },
  ];

  const handleAction = (type: ActionType, amount = 0) => {
    submitAction({ type, amount });
  };

  const setPreset = (amount: number) => {
    setRaiseAmount(Math.min(amount, maxRaise));
  };

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 max-w-[98vw]">
      <div className="flex flex-col items-center gap-1.5 bg-gray-900/90 backdrop-blur-sm rounded-xl px-3 py-2.5 sm:px-5 sm:py-3">

        {/* Top row: pot presets + raise slider */}
        {actions[ActionType.Raise] && (
          <div className="flex items-center gap-1.5 w-full justify-center">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setPreset(p.amount)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                  effectiveRaise === Math.min(p.amount, maxRaise)
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setRaiseAmount((prev) => Math.max(minRaise, (prev || minRaise) - bigBlind))}
              className="shrink-0 w-8 h-8 bg-gray-700 active:bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-bold text-base flex items-center justify-center"
            >
              -
            </button>
            <input
              type="range"
              min={minRaise}
              max={maxRaise}
              step={bigBlind}
              value={effectiveRaise}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              className="w-20 sm:w-28 h-2 accent-green-500 cursor-pointer shrink-0"
            />
            <button
              onClick={() => setRaiseAmount((prev) => Math.min(maxRaise, (prev || minRaise) + bigBlind))}
              className="shrink-0 w-8 h-8 bg-gray-700 active:bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-bold text-base flex items-center justify-center"
            >
              +
            </button>
          </div>
        )}

        {/* Bottom row: stack + timer + action buttons */}
        <div className="flex items-center gap-2">
          {/* Stack */}
          <span className="text-yellow-400 font-bold text-sm whitespace-nowrap shrink-0">${myChips}</span>
          <span className="text-gray-600 shrink-0">|</span>

          {/* Timer */}
          {timerSeconds !== null && (
            <>
              <span className={`font-mono font-bold text-sm shrink-0 ${timerSeconds <= 10 ? 'text-red-400' : 'text-yellow-400'}`}>
                {timerSeconds}s
              </span>
              <span className="text-gray-600 shrink-0">|</span>
            </>
          )}

          {/* Fold */}
          {actions[ActionType.Fold] && (
            <button
              onClick={() => handleAction(ActionType.Fold)}
              className="shrink-0 px-4 py-2.5 bg-red-600 active:bg-red-800 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition-colors min-h-[42px]"
            >
              Fold
            </button>
          )}

          {/* Check */}
          {actions[ActionType.Check] && (
            <button
              onClick={() => handleAction(ActionType.Check)}
              className="shrink-0 px-4 py-2.5 bg-gray-600 active:bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold text-sm transition-colors min-h-[42px]"
            >
              Check
            </button>
          )}

          {/* Call */}
          {actions[ActionType.Call] && (
            <button
              onClick={() => handleAction(ActionType.Call, actions[ActionType.Call].amount)}
              className="shrink-0 px-4 py-2.5 bg-blue-600 active:bg-blue-800 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-colors min-h-[42px]"
            >
              Call ${actions[ActionType.Call].amount}
            </button>
          )}

          {/* Raise / Bet */}
          {actions[ActionType.Raise] && (
            <button
              onClick={() => handleAction(ActionType.Raise, effectiveRaise)}
              className="shrink-0 px-4 py-2.5 bg-green-600 active:bg-green-800 hover:bg-green-700 text-white rounded-lg font-bold text-sm transition-colors min-h-[42px]"
            >
              {isBet ? 'Bet' : 'Raise'} ${effectiveRaise}
            </button>
          )}

          {/* All-in */}
          {actions[ActionType.AllIn] && (
            <button
              onClick={() => handleAction(ActionType.AllIn, actions[ActionType.AllIn].amount)}
              className="shrink-0 px-4 py-2.5 bg-yellow-600 active:bg-yellow-800 hover:bg-yellow-700 text-white rounded-lg font-bold text-sm transition-colors min-h-[42px]"
            >
              All-in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
