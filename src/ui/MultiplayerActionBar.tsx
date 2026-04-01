'use client';

import { useState, useMemo, useEffect } from 'react';
import { useMultiplayerStore } from '@/store/multiplayer-store';
import { ActionType, Phase } from '@/engine/types';
import { playCheck, playFold, playAllIn, playCallAllIn, playChipBet, playRaise } from '@/lib/sounds';

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
  const isCallAllIn = !!actions[ActionType.AllIn] && !actions[ActionType.Call] && toCall > 0;
  const isBet = gameState.currentBet === 0;

  const handleAction = (type: ActionType, amount = 0) => {
    switch (type) {
      case ActionType.Check: playCheck(); break;
      case ActionType.Fold: playFold(); break;
      case ActionType.AllIn: (isCallAllIn ? playCallAllIn : playAllIn)(); break;
      case ActionType.Call: playChipBet(); break;
      case ActionType.Raise: playRaise(); break;
    }
    submitAction({ type, amount });
  };

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 max-w-[98vw]">
      <div className="flex items-center gap-1.5 bg-gray-900/90 backdrop-blur-sm rounded-xl px-3 py-2 sm:px-4 sm:py-2.5">
        {/* Stack */}
        <span className="text-yellow-400 font-bold text-xs sm:text-sm whitespace-nowrap shrink-0">${myChips}</span>
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
            className="shrink-0 px-3 py-2 bg-red-600 active:bg-red-800 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition-colors min-h-[40px]"
          >
            Fold
          </button>
        )}

        {/* Check */}
        {actions[ActionType.Check] && (
          <button
            onClick={() => handleAction(ActionType.Check)}
            className="shrink-0 px-3 py-2 bg-gray-600 active:bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold text-sm transition-colors min-h-[40px]"
          >
            Check
          </button>
        )}

        {/* Call */}
        {actions[ActionType.Call] && (
          <button
            onClick={() => handleAction(ActionType.Call, actions[ActionType.Call].amount)}
            className="shrink-0 px-3 py-2 bg-blue-600 active:bg-blue-800 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-colors min-h-[40px]"
          >
            Call ${actions[ActionType.Call].amount}
          </button>
        )}

        {/* Raise: - slider + button */}
        {actions[ActionType.Raise] && (
          <>
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
              className="w-16 sm:w-24 h-2 accent-green-500 cursor-pointer shrink-0"
            />
            <button
              onClick={() => setRaiseAmount((prev) => Math.min(maxRaise, (prev || minRaise) + bigBlind))}
              className="shrink-0 w-8 h-8 bg-gray-700 active:bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-bold text-base flex items-center justify-center"
            >
              +
            </button>
            <button
              onClick={() => handleAction(ActionType.Raise, effectiveRaise)}
              className="shrink-0 px-3 py-2 bg-green-600 active:bg-green-800 hover:bg-green-700 text-white rounded-lg font-bold text-sm transition-colors min-h-[40px]"
            >
              {isBet ? 'Bet' : 'Raise'} ${effectiveRaise}
            </button>
          </>
        )}

        {/* All-in */}
        {actions[ActionType.AllIn] && (
          <button
            onClick={() => handleAction(ActionType.AllIn, actions[ActionType.AllIn].amount)}
            className="shrink-0 px-3 py-2 bg-yellow-600 active:bg-yellow-800 hover:bg-yellow-700 text-white rounded-lg font-bold text-sm transition-colors min-h-[40px]"
          >
            All-in
          </button>
        )}
      </div>
    </div>
  );
}
