import { ActionType, GameState, Player, PlayerAction } from './types';

export function getAvailableActions(state: GameState, player: Player): PlayerAction[] {
  const actions: PlayerAction[] = [];
  const toCall = state.currentBet - player.currentBet;

  actions.push({ type: ActionType.Fold, amount: 0 });

  if (toCall === 0) {
    actions.push({ type: ActionType.Check, amount: 0 });
  }

  if (toCall > 0 && toCall < player.chips) {
    actions.push({ type: ActionType.Call, amount: toCall });
  }

  const minRaiseTotal = state.currentBet + state.minRaise;
  const raiseAmount = minRaiseTotal - player.currentBet;

  if (raiseAmount < player.chips) {
    actions.push({ type: ActionType.Raise, amount: raiseAmount });
  }

  if (player.chips > 0) {
    actions.push({ type: ActionType.AllIn, amount: player.chips });
  }

  return actions;
}

export function applyAction(
  state: GameState,
  playerIndex: number,
  action: PlayerAction,
): GameState {
  const newState = deepCloneState(state);
  const player = newState.players[playerIndex];
  player.lastAction = action.type;

  switch (action.type) {
    case ActionType.Fold:
      player.isFolded = true;
      break;

    case ActionType.Check:
      break;

    case ActionType.Call: {
      const callAmount = Math.min(action.amount, player.chips);
      player.chips -= callAmount;
      player.currentBet += callAmount;
      player.totalBet += callAmount;
      newState.pot += callAmount;
      if (player.chips === 0) player.isAllIn = true;
      break;
    }

    case ActionType.Raise: {
      const raiseAmount = Math.min(action.amount, player.chips);
      player.chips -= raiseAmount;
      player.currentBet += raiseAmount;
      player.totalBet += raiseAmount;
      newState.pot += raiseAmount;

      const raiseIncrease = player.currentBet - newState.currentBet;
      if (raiseIncrease > newState.minRaise) {
        newState.minRaise = raiseIncrease;
      }
      newState.currentBet = player.currentBet;

      if (player.chips === 0) player.isAllIn = true;

      // Reset hasActed for others since there's a raise
      newState.players.forEach((p, i) => {
        if (i !== playerIndex && !p.isFolded && !p.isAllIn) {
          p.hasActed = false;
        }
      });
      break;
    }

    case ActionType.AllIn: {
      const allInAmount = player.chips;
      player.currentBet += allInAmount;
      player.totalBet += allInAmount;
      newState.pot += allInAmount;
      player.chips = 0;
      player.isAllIn = true;

      if (player.currentBet > newState.currentBet) {
        const raiseIncrease = player.currentBet - newState.currentBet;
        if (raiseIncrease > newState.minRaise) {
          newState.minRaise = raiseIncrease;
        }
        newState.currentBet = player.currentBet;

        newState.players.forEach((p, i) => {
          if (i !== playerIndex && !p.isFolded && !p.isAllIn) {
            p.hasActed = false;
          }
        });
      }
      break;
    }
  }

  player.hasActed = true;
  return newState;
}

export function isBettingRoundOver(state: GameState): boolean {
  const activePlayers = state.players.filter((p) => !p.isFolded && !p.isAllIn);

  if (activePlayers.length === 0) return true;
  if (activePlayers.length === 1 && state.players.filter((p) => !p.isFolded).length === 1) {
    return true;
  }

  return activePlayers.every((p) => p.hasActed && p.currentBet === state.currentBet);
}

export function getNextActivePlayerIndex(state: GameState, fromIndex: number): number {
  const count = state.players.length;
  let idx = (fromIndex + 1) % count;

  while (idx !== fromIndex) {
    const p = state.players[idx];
    if (!p.isFolded && !p.isAllIn) return idx;
    idx = (idx + 1) % count;
  }

  return -1;
}

export function countActivePlayers(state: GameState): number {
  return state.players.filter((p) => !p.isFolded).length;
}

function deepCloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}
