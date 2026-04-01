'use client';

import { useState, useMemo } from 'react';
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

  const actions = useMemo(() => {
    const map: Record<string, { type: ActionType; amount: number }> = {};
    for (const a of availableActions) {
      map[a.type] = { type: a.type, amount: a.amount };
    }
    return map;
  }, [availableActions]);

  if (!gameState) return null;
  if (gameState.phase === Phase.Settle || gameState.phase === Phase.Showdown) return null;

  const timerSeconds = turnTimer ? Math.ceil(turnTimer.remainingMs / 1000) : null;
  const activePlayer = gameState.players[gameState.activePlayerIndex];

  if (!isMyTurn) {
    return (
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-sm rounded-xl px-4 py-2.5 sm:px-6 sm:py-3 flex items-center gap-3 sm:gap-4">
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
  const myPlayer = gameState.players.find((p) => p.id === mySocketId);
  const minRaise = actions[ActionType.Raise]?.amount ?? gameState.minRaise;
  const maxRaise = myPlayer ? myPlayer.chips : 0;

  const toCall = gameState.currentBet - (myPlayer?.currentBet ?? 0);
  const isCallAllIn = !!actions[ActionType.AllIn] && !actions[ActionType.Call] && toCall > 0;

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
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 max-w-[95vw]">
      {timerSeconds !== null && (
        <span className={`font-mono font-bold text-base sm:text-lg ${timerSeconds <= 10 ? 'text-red-400' : 'text-yellow-400'}`}>
          {timerSeconds}s
        </span>
      )}

      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 items-center bg-gray-900/90 rounded-xl px-3 py-3 sm:px-4 sm:py-3 backdrop-blur-sm">
        {actions[ActionType.Fold] && (
          <button
            onClick={() => handleAction(ActionType.Fold)}
            className="px-4 py-2.5 sm:px-6 sm:py-3 bg-red-600 active:bg-red-800 hover:bg-red-700 text-white rounded-xl font-bold text-sm sm:text-lg transition-colors shadow-lg min-h-[44px]"
          >
            Fold
          </button>
        )}

        {actions[ActionType.Check] && (
          <button
            onClick={() => handleAction(ActionType.Check)}
            className="px-4 py-2.5 sm:px-6 sm:py-3 bg-gray-600 active:bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold text-sm sm:text-lg transition-colors shadow-lg min-h-[44px]"
          >
            Check
          </button>
        )}

        {actions[ActionType.Call] && (
          <button
            onClick={() => handleAction(ActionType.Call, actions[ActionType.Call].amount)}
            className="px-4 py-2.5 sm:px-6 sm:py-3 bg-blue-600 active:bg-blue-800 hover:bg-blue-700 text-white rounded-xl font-bold text-sm sm:text-lg transition-colors shadow-lg min-h-[44px]"
          >
            Call ${actions[ActionType.Call].amount}
          </button>
        )}

        {actions[ActionType.Raise] && (
          <>
            <button
              onClick={() => setRaiseAmount((prev) => Math.max(minRaise, prev - bigBlind))}
              className="w-9 h-9 sm:w-auto sm:px-3 sm:py-3 bg-gray-700 active:bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-bold flex items-center justify-center min-h-[36px]"
            >
              -
            </button>
            <button
              onClick={() => handleAction(ActionType.Raise, raiseAmount || minRaise)}
              className="px-4 py-2.5 sm:px-6 sm:py-3 bg-green-600 active:bg-green-800 hover:bg-green-700 text-white rounded-xl font-bold text-sm sm:text-lg transition-colors shadow-lg min-h-[44px]"
            >
              Raise ${raiseAmount || minRaise}
            </button>
            <button
              onClick={() => setRaiseAmount((prev) => Math.min(maxRaise, prev + bigBlind))}
              className="w-9 h-9 sm:w-auto sm:px-3 sm:py-3 bg-gray-700 active:bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-bold flex items-center justify-center min-h-[36px]"
            >
              +
            </button>
          </>
        )}

        {actions[ActionType.AllIn] && (
          <button
            onClick={() => handleAction(ActionType.AllIn, actions[ActionType.AllIn].amount)}
            className="px-4 py-2.5 sm:px-6 sm:py-3 bg-yellow-600 active:bg-yellow-800 hover:bg-yellow-700 text-white rounded-xl font-bold text-sm sm:text-lg transition-colors shadow-lg min-h-[44px]"
          >
            All-in ${actions[ActionType.AllIn].amount}
          </button>
        )}
      </div>
    </div>
  );
}
