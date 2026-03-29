'use client';

import { useState, useMemo } from 'react';
import { useMultiplayerStore } from '@/store/multiplayer-store';
import { ActionType, Phase } from '@/engine/types';
import { playCheck, playFold, playAllIn, playChipBet } from '@/lib/sounds';

export default function MultiplayerActionBar() {
  const gameState = useMultiplayerStore((s) => s.gameState);
  const availableActions = useMultiplayerStore((s) => s.availableActions);
  const isMyTurn = useMultiplayerStore((s) => s.isMyTurn);
  const turnTimer = useMultiplayerStore((s) => s.turnTimer);
  const mySocketId = useMultiplayerStore((s) => s.mySocketId);
  const submitAction = useMultiplayerStore((s) => s.submitAction);

  const [raiseAmount, setRaiseAmount] = useState(0);

  // Derive action types
  const actions = useMemo(() => {
    const map: Record<string, { type: ActionType; amount: number }> = {};
    for (const a of availableActions) {
      map[a.type] = { type: a.type, amount: a.amount };
    }
    return map;
  }, [availableActions]);

  if (!gameState) return null;
  if (gameState.phase === Phase.Settle || gameState.phase === Phase.Showdown) return null;

  // Timer display
  const timerSeconds = turnTimer ? Math.ceil(turnTimer.remainingMs / 1000) : null;
  const activePlayer = gameState.players[gameState.activePlayerIndex];

  if (!isMyTurn) {
    return (
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-sm rounded-xl px-6 py-3 flex items-center gap-4">
        <span className="text-gray-400">
          Waiting for <span className="text-white font-medium">{activePlayer?.name}</span>...
        </span>
        {timerSeconds !== null && (
          <span className={`font-mono font-bold text-lg ${timerSeconds <= 10 ? 'text-red-400' : 'text-yellow-400'}`}>
            {timerSeconds}s
          </span>
        )}
      </div>
    );
  }

  const bigBlind = gameState.config.bigBlind;
  const minRaise = gameState.minRaise;
  const myPlayer = gameState.players.find((p) => p.id === mySocketId);
  const maxRaise = myPlayer ? myPlayer.chips + myPlayer.currentBet : 0;

  const handleAction = (type: ActionType, amount = 0) => {
    switch (type) {
      case ActionType.Check: playCheck(); break;
      case ActionType.Fold: playFold(); break;
      case ActionType.AllIn: playAllIn(); break;
      case ActionType.Call:
      case ActionType.Raise: playChipBet(); break;
    }
    submitAction({ type, amount });
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
      {/* Timer */}
      {timerSeconds !== null && (
        <span className={`font-mono font-bold text-lg ${timerSeconds <= 10 ? 'text-red-400' : 'text-yellow-400'}`}>
          {timerSeconds}s
        </span>
      )}

      <div className="flex gap-2 items-center">
        {/* Fold */}
        {actions[ActionType.Fold] && (
          <button
            onClick={() => handleAction(ActionType.Fold)}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg transition-colors shadow-lg"
          >
            Fold
          </button>
        )}

        {/* Check */}
        {actions[ActionType.Check] && (
          <button
            onClick={() => handleAction(ActionType.Check)}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-bold text-lg transition-colors shadow-lg"
          >
            Check
          </button>
        )}

        {/* Call */}
        {actions[ActionType.Call] && (
          <button
            onClick={() => handleAction(ActionType.Call, actions[ActionType.Call].amount)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg transition-colors shadow-lg"
          >
            Call ${actions[ActionType.Call].amount}
          </button>
        )}

        {/* Raise */}
        {actions[ActionType.Raise] && (
          <>
            <button
              onClick={() => setRaiseAmount((prev) => Math.max(minRaise, prev - bigBlind))}
              className="px-3 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold"
            >
              -
            </button>
            <button
              onClick={() => handleAction(ActionType.Raise, raiseAmount || minRaise)}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg transition-colors shadow-lg"
            >
              Raise ${raiseAmount || minRaise}
            </button>
            <button
              onClick={() => setRaiseAmount((prev) => Math.min(maxRaise, prev + bigBlind))}
              className="px-3 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold"
            >
              +
            </button>
          </>
        )}

        {/* All-in */}
        {actions[ActionType.AllIn] && (
          <button
            onClick={() => handleAction(ActionType.AllIn, actions[ActionType.AllIn].amount)}
            className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-bold text-lg transition-colors shadow-lg"
          >
            All-in ${actions[ActionType.AllIn].amount}
          </button>
        )}
      </div>
    </div>
  );
}
