'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
} from 'pixi.js';
import { useGameStore } from '@/store/game-store';
import { getCardTexture, getCardBackTexture, clearTextureCache } from '@/lib/card-textures';
import {
  getSeatPositions,
  COMMUNITY_CARDS_START_X,
  COMMUNITY_CARDS_Y,
  COMMUNITY_CARD_SPACING,
  CARD_WIDTH,
  CARD_HEIGHT,
  DECK_POSITION,
  SeatPosition,
} from '@/lib/positions';
import { Player, Card, Phase, GameState, ActionType } from '@/engine/types';
import { evaluateHand } from '@/engine/hand-evaluator';
import { animateDeal } from '@/animations/deal';
import { animateFlop, animateTurnOrRiver } from '@/animations/community';
import { animateChipsToWinner, animateChipsToPot } from '@/animations/chips';
import { animateShowdown } from '@/animations/showdown';

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const TABLE_CX = 640;
const TABLE_CY = 340;
const POT_X = 640;
const POT_Y = 250;

interface PokerCanvasProps {
  externalState?: GameState | null;
  localPlayerId?: string;
  onSetAnimating?: (v: boolean) => void;
}

export default function PokerCanvas({ externalState, localPlayerId, onSetAnimating }: PokerCanvasProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const gameContainerRef = useRef<Container | null>(null);
  const prevPhaseRef = useRef<Phase | null>(null);
  const prevPlayersRef = useRef<Player[] | null>(null);
  const animatingRef = useRef(false);

  const storeState = useGameStore((s) => s.state);
  const state = externalState !== undefined ? externalState : storeState;
  const showOpponentHands = useGameStore((s) => s.showOpponentHands);
  const showStackInBlinds = useGameStore((s) => s.showStackInBlinds);
  // Subscribe so the component re-renders once animations finish.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _isAnimating = useGameStore((s) => s.isAnimating);

  const setAnimatingFn = useCallback((v: boolean) => {
    if (onSetAnimating) {
      onSetAnimating(v);
    } else {
      useGameStore.getState().setAnimating(v);
    }
  }, [onSetAnimating]);

  /**
   * Play phase-transition animations BEFORE rendering the new state.
   * Returns true if an animation was played (caller should re-render after).
   */
  const playPhaseAnimations = useCallback(
    async (
      newPhase: Phase,
      prevPhase: Phase | null,
      currentState: GameState,
    ): Promise<boolean> => {
      const app = appRef.current;
      if (!app || !app.renderer) return false;

      // Only animate on actual phase transitions
      if (newPhase === prevPhase) return false;

      const gc = gameContainerRef.current;
      if (!gc) return false;

      const seats = getSeatPositions(currentState.players.length);
      let animated = false;

      // --- Deal phase: cards fly from deck to players ---
      if (newPhase === Phase.Deal || newPhase === Phase.PreFlop) {
        if (prevPhase === Phase.Blinds || prevPhase === Phase.Idle || prevPhase === Phase.Settle) {
          animatingRef.current = true;
          setAnimatingFn(true);
          animated = true;

          try {
            await animateDeal(
              app,
              gc,
              currentState.players,
              seats,
              DECK_POSITION,
              localPlayerId,
            );
          } finally {
            animatingRef.current = false;
            setAnimatingFn(false);
          }
        }
      }

      // --- Collect bets into pot + deal community cards ---
      const isCommunityPhase =
        (newPhase === Phase.Flop && prevPhase !== Phase.Flop) ||
        (newPhase === Phase.Turn && prevPhase !== Phase.Turn) ||
        (newPhase === Phase.River && prevPhase !== Phase.River);

      if (isCommunityPhase) {
        animatingRef.current = true;
        setAnimatingFn(true);
        animated = true;

        try {
          // Animate bets collecting into pot (using previous state's bets)
          const prevPlayers = prevPlayersRef.current;
          if (prevPlayers) {
            const prevSeats = getSeatPositions(prevPlayers.length);
            const potPosition = { x: POT_X, y: POT_Y };
            const hasBets = prevPlayers.some((p) => p.currentBet > 0);
            if (hasBets) {
              await animateChipsToPot(gc, prevSeats, prevPlayers, potPosition);
              await new Promise((r) => setTimeout(r, 200));
            }
          }

          // Deal community cards + pause after reveal
          if (newPhase === Phase.Flop && currentState.communityCards.length >= 3) {
            const flopCards = currentState.communityCards.slice(0, 3);
            await animateFlop(app, gc, flopCards);
            await new Promise((r) => setTimeout(r, 800));
          } else if (newPhase === Phase.Turn && currentState.communityCards.length >= 4) {
            await animateTurnOrRiver(app, gc, currentState.communityCards[3], 3);
            await new Promise((r) => setTimeout(r, 600));
          } else if (newPhase === Phase.River && currentState.communityCards.length >= 5) {
            await animateTurnOrRiver(app, gc, currentState.communityCards[4], 4);
            await new Promise((r) => setTimeout(r, 600));
          }
        } finally {
          animatingRef.current = false;
          setAnimatingFn(false);
        }
      }

      // --- Showdown: collect final bets + highlight winners ---
      if (newPhase === Phase.Showdown && prevPhase !== Phase.Showdown) {
        if (currentState.winners.length > 0) {
          animatingRef.current = true;
          setAnimatingFn(true);
          animated = true;

          try {
            // Collect last round's bets into pot
            const prevPlayers = prevPlayersRef.current;
            if (prevPlayers) {
              const prevSeats = getSeatPositions(prevPlayers.length);
              const potPosition = { x: POT_X, y: POT_Y };
              const hasBets = prevPlayers.some((p) => p.currentBet > 0);
              if (hasBets) {
                await animateChipsToPot(gc, prevSeats, prevPlayers, potPosition);
                await new Promise((r) => setTimeout(r, 200));
              }
            }

            const winnerIndices = currentState.winners
              .map((w) =>
                currentState.players.findIndex((p) => p.id === w.playerId),
              )
              .filter((idx) => idx !== -1);

            if (winnerIndices.length > 0) {
              await animateShowdown(gc, winnerIndices, seats);
            }
          } finally {
            animatingRef.current = false;
            setAnimatingFn(false);
          }
        }
      }

      // --- Settle: collect remaining bets + chips fly to winner ---
      if (newPhase === Phase.Settle && prevPhase !== Phase.Settle) {
        if (currentState.winners.length > 0) {
          animatingRef.current = true;
          setAnimatingFn(true);
          animated = true;

          try {
            // Collect remaining bets (e.g. when everyone folds, skipping showdown)
            const prevPlayers = prevPlayersRef.current;
            if (prevPlayers && prevPhase !== Phase.Showdown) {
              const prevSeats = getSeatPositions(prevPlayers.length);
              const potPos = { x: POT_X, y: POT_Y };
              const hasBets = prevPlayers.some((p) => p.currentBet > 0);
              if (hasBets) {
                await animateChipsToPot(gc, prevSeats, prevPlayers, potPos);
                await new Promise((r) => setTimeout(r, 200));
              }
            }

            const potPosition = { x: POT_X, y: POT_Y };
            const chipPromises = currentState.winners.map((winner) => {
              const playerIndex = currentState.players.findIndex(
                (p) => p.id === winner.playerId,
              );
              if (playerIndex === -1) return Promise.resolve();
              const seat = seats[playerIndex];
              return animateChipsToWinner(
                gc,
                potPosition,
                seat,
                winner.amount,
              );
            });
            await Promise.all(chipPromises);
          } finally {
            animatingRef.current = false;
            setAnimatingFn(false);
          }
        }
      }

      return animated;
    },
    [setAnimatingFn, localPlayerId],
  );

  const renderGame = useCallback(() => {
    const app = appRef.current;
    if (!app || !app.renderer || !state) return;

    // Don't destroy the scene while an animation is still running —
    // animations hold refs to children and PixiJS nulls _position on destroy.
    if (animatingRef.current) return;

    // Clear previous render
    if (gameContainerRef.current) {
      gameContainerRef.current.destroy({ children: true });
    }

    const gc = new Container();
    gameContainerRef.current = gc;
    app.stage.addChild(gc);

    // Draw table
    drawTable(gc);

    // Draw players — hide hole cards when deal animation is about to play
    const seats = getSeatPositions(state.players.length);
    const prevP = prevPhaseRef.current;
    const isDealAnim = (state.phase === Phase.Deal || state.phase === Phase.PreFlop)
      && (prevP === Phase.Blinds || prevP === Phase.Idle || prevP === Phase.Settle);
    state.players.forEach((player, i) => {
      drawPlayer(app, gc, player, seats[i], state.phase, i === state.activePlayerIndex, state.config.bigBlind, isDealAnim, localPlayerId, showOpponentHands || !!state.allInRunout, showStackInBlinds);
    });

    // Draw community cards — skip cards that are about to be animated
    if (state.communityCards.length > 0) {
      const prevPhase = prevPhaseRef.current;
      const isNewFlop = (state.phase === Phase.Flop) && (prevPhase !== Phase.Flop);
      const isNewTurn = (state.phase === Phase.Turn) && (prevPhase !== Phase.Turn);
      const isNewRiver = (state.phase === Phase.River) && (prevPhase !== Phase.River);

      let visibleCount = state.communityCards.length;
      if (isNewFlop) visibleCount = 0;       // flop animation will show all 3
      else if (isNewTurn) visibleCount = 3;   // only show flop, turn animates
      else if (isNewRiver) visibleCount = 4;  // show flop+turn, river animates

      if (visibleCount > 0) {
        drawCommunityCards(app, gc, state.communityCards.slice(0, visibleCount));
      }
    }

    // Draw pot (hide during settle animation)
    if (state.pot > 0 && state.phase !== Phase.Settle && state.phase !== Phase.PreFlop) {
      drawPot(gc, state.pot, state.config.bigBlind, showStackInBlinds);
    }

    // Draw dealer, SB, BB buttons
    drawPositionButtons(gc, seats, state.dealerIndex, state.players.length);

    // At showdown/settle: show hand names for non-folded players
    if (state.phase === Phase.Showdown || state.phase === Phase.Settle) {
      drawHandLabels(gc, state, seats);
    }

    // Detect phase transitions and play animations
    const prevPhase = prevPhaseRef.current;
    const newPhase = state.phase;

    if (prevPhase !== null && prevPhase !== newPhase) {
      // Set animating synchronously BEFORE the async animation starts,
      // so the ActionBar hides immediately (no flash of buttons before cards appear).
      animatingRef.current = true;
      setAnimatingFn(true);
      playPhaseAnimations(newPhase, prevPhase, state).then((didAnimate) => {
        if (!didAnimate) {
          // No animation played — reset immediately
          animatingRef.current = false;
          setAnimatingFn(false);
        }
      });
    }

    // Store current players (with bets) for next phase transition animation
    prevPlayersRef.current = JSON.parse(JSON.stringify(state.players));
    prevPhaseRef.current = newPhase;
  }, [state, playPhaseAnimations, setAnimatingFn, localPlayerId, showOpponentHands, showStackInBlinds]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    const app = new Application();
    const initPromise = app.init({
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      background: 0x1a472a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      resizeTo: undefined,
    });

    initPromise.then(() => {
      if (cancelled || !containerRef.current) return;
      containerRef.current.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;
      renderGame();
    });

    return () => {
      cancelled = true;
      clearTextureCache();
      initPromise.then(() => {
        app.destroy(true);
      });
      appRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run renderGame when state changes OR when animation finishes.
  // _isAnimating is needed so that a state update that arrived mid-animation
  // gets rendered once the animation completes (otherwise the useEffect doesn't
  // re-fire because renderGame ref hasn't changed).
  useEffect(() => {
    renderGame();
  }, [renderGame, _isAnimating]);

  return (
    <div
      ref={containerRef}
      className="w-full flex justify-center"
      style={{ maxWidth: CANVAS_WIDTH }}
    />
  );
}

// --- Drawing helpers ---

function drawTable(container: Container) {
  const table = new Graphics();
  table.ellipse(640, 340, 450, 230);
  table.fill({ color: 0x5d3a1a });
  table.ellipse(640, 340, 420, 200);
  table.fill({ color: 0x27683e });
  table.ellipse(640, 340, 380, 170);
  table.stroke({ color: 0x2d7a48, width: 2 });
  container.addChild(table);
}

function drawPlayer(
  app: Application,
  container: Container,
  player: Player,
  seat: SeatPosition,
  phase: Phase,
  isActive: boolean,
  bigBlind: number,
  hideCards = false,
  localPlayerId?: string,
  showOpponentHands = false,
  showStackInBlinds = false,
) {
  const pc = new Container();
  pc.x = seat.x;
  pc.y = seat.y;

  // Player info background
  const infoBg = new Graphics();
  const bgColor = isActive ? 0xf39c12 : (player.isFolded ? 0x555555 : 0x2c3e50);
  infoBg.roundRect(-50, seat.labelAnchor === 'top' ? -90 : 40, 100, 50, 8);
  infoBg.fill({ color: bgColor, alpha: 0.9 });
  pc.addChild(infoBg);

  // Name
  const nameText = new Text({
    text: player.name,
    style: new TextStyle({ fontFamily: 'Arial', fontSize: 13, fill: 0xffffff, fontWeight: 'bold' }),
  });
  nameText.anchor.set(0.5, 0);
  nameText.y = seat.labelAnchor === 'top' ? -85 : 45;
  pc.addChild(nameText);

  // Chips
  const bb = bigBlind || 10;
  const stackLabel = showStackInBlinds
    ? `${(player.chips / bb).toFixed(1)} BB`
    : `$${player.chips}`;
  const chipText = new Text({
    text: stackLabel,
    style: new TextStyle({ fontFamily: 'Arial', fontSize: 12, fill: 0xf1c40f }),
  });
  chipText.anchor.set(0.5, 0);
  chipText.y = seat.labelAnchor === 'top' ? -68 : 62;
  pc.addChild(chipText);

  // Current bet — drawn towards table center
  if (player.currentBet > 0) {
    const dx = TABLE_CX - seat.x;
    const dy = TABLE_CY - seat.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const offsetDist = 120;
    const betX = (dx / dist) * offsetDist;
    const betY = (dy / dist) * offsetDist;

    const betContainer = new Container();
    betContainer.x = betX;
    betContainer.y = betY;

    const chipColors = [0xe74c3c, 0x2ecc71, 0x3498db, 0xf1c40f, 0x000000];
    const chipCount = Math.min(Math.ceil(player.currentBet / (bigBlind || 10)), 5);
    for (let c = 0; c < chipCount; c++) {
      const chip = new Graphics();
      chip.circle(0, -c * 4, 8);
      chip.fill({ color: chipColors[c % chipColors.length] });
      chip.stroke({ color: 0xffffff, width: 1 });
      betContainer.addChild(chip);
    }

    const betText = showStackInBlinds
      ? `${(player.currentBet / bb).toFixed(1)} BB`
      : `$${player.currentBet}`;
    const betLabel = new Text({
      text: betText,
      style: new TextStyle({
        fontFamily: 'Arial', fontSize: 11, fill: 0xffffff, fontWeight: 'bold',
        dropShadow: { color: 0x000000, blur: 2, distance: 1 },
      }),
    });
    betLabel.anchor.set(0.5, 0);
    betLabel.y = -chipCount * 4 - 16;
    betContainer.addChild(betLabel);

    pc.addChild(betContainer);
  }

  // Hole cards — skip during Deal phase or when deal animation is about to play
  if (player.holeCards && !player.isFolded && phase !== Phase.Idle && phase !== Phase.Deal && !hideCards) {
    const isLocal = localPlayerId ? player.id === localPlayerId : player.isHuman;
    const showCards = isLocal || showOpponentHands || phase === Phase.Showdown || phase === Phase.Settle;
    drawHoleCards(app, pc, player.holeCards, showCards);
  }

  // Last action label (Check, Call, Raise, etc.) — shown toward table center
  if (player.lastAction !== undefined && !player.isFolded && player.currentBet === 0) {
    const actionLabels: Partial<Record<ActionType, { text: string; color: number }>> = {
      [ActionType.Check]: { text: 'Check', color: 0x2ecc71 },
    };
    const info = actionLabels[player.lastAction];
    if (info) {
      const dx = TABLE_CX - seat.x;
      const dy = TABLE_CY - seat.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const offsetDist = 120;
      const actionText = new Text({
        text: info.text,
        style: new TextStyle({
          fontFamily: 'Arial', fontSize: 13, fill: info.color, fontWeight: 'bold',
          dropShadow: { color: 0x000000, blur: 3, distance: 1 },
        }),
      });
      actionText.anchor.set(0.5);
      actionText.x = (dx / dist) * offsetDist;
      actionText.y = (dy / dist) * offsetDist;
      pc.addChild(actionText);
    }
  }

  // Folded overlay
  if (player.isFolded) {
    const foldText = new Text({
      text: 'FOLD',
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 14, fill: 0xe74c3c, fontWeight: 'bold' }),
    });
    foldText.anchor.set(0.5);
    foldText.y = seat.labelAnchor === 'top' ? 20 : -20;
    foldText.alpha = 0.8;
    pc.addChild(foldText);
  }

  container.addChild(pc);
}

function drawHoleCards(
  app: Application,
  container: Container,
  cards: Card[],
  faceUp: boolean,
) {
  const count = cards.length;
  // Adjust card size and spacing based on card count
  let cardW = CARD_WIDTH;
  let spacing = CARD_WIDTH * 0.7;

  if (count === 4) {
    cardW = CARD_WIDTH * 0.8;
    spacing = cardW * 0.65;
  } else if (count >= 5) {
    cardW = CARD_WIDTH * 0.7;
    spacing = cardW * 0.6;
  }

  const cardH = cardW * (CARD_HEIGHT / CARD_WIDTH);
  const totalWidth = (count - 1) * spacing;
  const startX = -totalWidth / 2;

  cards.forEach((card, i) => {
    const texture = faceUp ? getCardTexture(app, card) : getCardBackTexture(app);
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.x = startX + i * spacing;
    sprite.width = cardW;
    sprite.height = cardH;
    container.addChild(sprite);
  });
}

function drawCommunityCards(app: Application, container: Container, cards: Card[]) {
  cards.forEach((card, i) => {
    const texture = getCardTexture(app, card);
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.x = COMMUNITY_CARDS_START_X + i * COMMUNITY_CARD_SPACING;
    sprite.y = COMMUNITY_CARDS_Y;
    sprite.width = CARD_WIDTH;
    sprite.height = CARD_HEIGHT;
    container.addChild(sprite);
  });
}

function drawPot(container: Container, pot: number, bigBlind = 10, showStackInBlinds = false) {
  const potContainer = new Container();
  potContainer.x = POT_X;
  potContainer.y = POT_Y;

  // Draw chip pile
  const chipColors = [0xe74c3c, 0x2ecc71, 0x3498db, 0xf1c40f, 0x9b59b6];
  const chipCount = Math.min(Math.ceil(pot / 50), 8);

  // Arrange chips in a small cluster
  for (let c = 0; c < chipCount; c++) {
    const chip = new Graphics();
    // Slight horizontal spread, stacked vertically
    const col = c % 4;
    const row = Math.floor(c / 4);
    chip.circle(0, 0, 7);
    chip.fill({ color: chipColors[c % chipColors.length] });
    chip.stroke({ color: 0xffffff, width: 1, alpha: 0.6 });
    chip.x = (col - 1.5) * 10;
    chip.y = 14 - row * 4;
    potContainer.addChild(chip);
  }

  // Pot text above chips
  const potText = new Text({
    text: showStackInBlinds ? `Pot: ${(pot / bigBlind).toFixed(1)} BB` : `Pot: $${pot}`,
    style: new TextStyle({
      fontFamily: 'Arial', fontSize: 16, fontWeight: 'bold', fill: 0xf1c40f,
      dropShadow: { color: 0x000000, blur: 4, distance: 2 },
    }),
  });
  potText.anchor.set(0.5);
  potText.y = -6;
  potContainer.addChild(potText);

  container.addChild(potContainer);
}

function drawPositionButtons(container: Container, seats: SeatPosition[], dealerIndex: number, playerCount: number) {
  const buttons: { index: number; label: string; bg: number; text: number }[] = [
    { index: dealerIndex, label: 'D', bg: 0xffffff, text: 0x333333 },
  ];

  if (playerCount === 2) {
    // Heads-up: dealer is SB, other is BB
    buttons.push({ index: (dealerIndex + 1) % playerCount, label: 'BB', bg: 0xf1c40f, text: 0x000000 });
    buttons[0] = { index: dealerIndex, label: 'D/SB', bg: 0xffffff, text: 0x333333 };
  } else {
    const sbIndex = (dealerIndex + 1) % playerCount;
    const bbIndex = (dealerIndex + 2) % playerCount;
    buttons.push({ index: sbIndex, label: 'SB', bg: 0x3498db, text: 0xffffff });
    buttons.push({ index: bbIndex, label: 'BB', bg: 0xf1c40f, text: 0x000000 });
  }

  for (const b of buttons) {
    if (b.index < 0 || b.index >= seats.length) continue;
    const seat = seats[b.index];

    const dx = TABLE_CX - seat.x;
    const dy = TABLE_CY - seat.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const offsetDist = 75;

    const btnContainer = new Container();
    btnContainer.x = seat.x + (dx / dist) * offsetDist;
    btnContainer.y = seat.y + (dy / dist) * offsetDist;

    const btn = new Graphics();
    btn.circle(0, 0, 13);
    btn.fill({ color: b.bg });
    btn.stroke({ color: 0x333333, width: 2 });
    btnContainer.addChild(btn);

    const label = new Text({
      text: b.label,
      style: new TextStyle({ fontFamily: 'Arial', fontSize: b.label.length > 2 ? 8 : 11, fontWeight: 'bold', fill: b.text }),
    });
    label.anchor.set(0.5);
    btnContainer.addChild(label);

    container.addChild(btnContainer);
  }
}

// --- Hand labels at showdown ---

function drawHandLabels(container: Container, state: GameState, seats: SeatPosition[]) {
  state.players.forEach((player, i) => {
    if (player.isFolded || !player.holeCards) return;

    const seat = seats[i];
    let handName = '';

    // Check if this player is a winner (use stored hand name)
    const winnerInfo = state.winners.find((w) => w.playerId === player.id);
    if (winnerInfo) {
      handName = winnerInfo.handName;
    } else if (state.communityCards.length >= 3) {
      // Evaluate hand for non-winner players still in
      const result = evaluateHand(player.holeCards as Card[], state.communityCards);
      handName = result.name;
    }

    if (!handName) return;

    const isWinner = !!winnerInfo;

    // Background pill
    const labelContainer = new Container();
    const labelY = seat.labelAnchor === 'top' ? seat.y + 55 : seat.y - 55;
    labelContainer.x = seat.x;
    labelContainer.y = labelY;

    const bg = new Graphics();
    bg.roundRect(-60, -10, 120, 20, 6);
    bg.fill({ color: isWinner ? 0x27ae60 : 0x34495e, alpha: 0.9 });
    labelContainer.addChild(bg);

    const label = new Text({
      text: handName,
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 11,
        fill: isWinner ? 0xf1c40f : 0xbdc3c7,
        fontWeight: isWinner ? 'bold' : 'normal',
      }),
    });
    label.anchor.set(0.5);
    labelContainer.addChild(label);

    container.addChild(labelContainer);
  });
}
