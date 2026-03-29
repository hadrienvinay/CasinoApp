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
import { useBlackjackStore } from '@/store/blackjack-store';
import { getCardTexture, getCardBackTexture, clearTextureCache } from '@/lib/card-textures';
import { CARD_WIDTH, CARD_HEIGHT } from '@/lib/positions';
import { Card } from '@/engine/types';
import { BJPhase, BJState } from '@/blackjack/types';
import { calculateHandValue, formatHandValue } from '@/blackjack/hand-value';
import { tweenTo, delayMs } from '@/animations/tween-manager';
import { animateFlip } from '@/animations/flip';
import { playCardDeal, playCardFlip } from '@/lib/sounds';

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const TABLE_CX = 640;
const TABLE_CY = 350;

// Layout positions
const DEALER_Y = 180;
const PLAYER_Y = 490;
const DECK_X = 950;
const DECK_Y = 100;

// Card spacing in a hand
const HAND_CARD_SPACING = 45;

function getPlayerHandX(handCount: number, handIndex: number): number {
  if (handCount === 1) return TABLE_CX;
  // Split: two hands side by side
  return handIndex === 0 ? TABLE_CX - 140 : TABLE_CX + 140;
}

export default function BlackjackCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const gameContainerRef = useRef<Container | null>(null);
  const prevPhaseRef = useRef<BJPhase | null>(null);
  const prevDealerCountRef = useRef<number>(0);
  const prevPlayerCardsRef = useRef<number[]>([]);
  const animatingRef = useRef(false);

  const state = useBlackjackStore((s) => s.state);
  useBlackjackStore((s) => s.isAnimating);

  const drawTable = useCallback((gc: Container) => {
    const table = new Graphics();
    // Green felt rectangle with rounded corners
    table.roundRect(120, 60, CANVAS_WIDTH - 240, CANVAS_HEIGHT - 120, 40);
    table.fill({ color: 0x1a6b3c });
    table.stroke({ color: 0x8b6914, width: 6 });
    gc.addChild(table);

    // Inner border
    const inner = new Graphics();
    inner.roundRect(140, 80, CANVAS_WIDTH - 280, CANVAS_HEIGHT - 160, 30);
    inner.stroke({ color: 0x2d8f5e, width: 2 });
    gc.addChild(inner);

    // Blackjack pays 3:2 text
    const payText = new Text({
      text: 'BLACKJACK PAYS 3 TO 2',
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 18,
        fontWeight: 'bold',
        fill: 0xdaa520,
        letterSpacing: 3,
      }),
    });
    payText.anchor.set(0.5);
    payText.x = TABLE_CX;
    payText.y = TABLE_CY - 20;
    payText.alpha = 0.6;
    gc.addChild(payText);

    // Dealer must stand on 17
    const ruleText = new Text({
      text: 'DEALER MUST STAND ON 17',
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 14,
        fill: 0xdaa520,
        letterSpacing: 2,
      }),
    });
    ruleText.anchor.set(0.5);
    ruleText.x = TABLE_CX;
    ruleText.y = TABLE_CY + 10;
    ruleText.alpha = 0.4;
    gc.addChild(ruleText);
  }, []);

  const drawCard = useCallback(
    (app: Application, gc: Container, card: Card, x: number, y: number, faceUp: boolean) => {
      const texture = faceUp ? getCardTexture(app, card) : getCardBackTexture(app);
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.x = x;
      sprite.y = y;
      sprite.width = CARD_WIDTH;
      sprite.height = CARD_HEIGHT;
      gc.addChild(sprite);
      return sprite;
    },
    [],
  );

  const drawHandValueLabel = useCallback(
    (gc: Container, cards: Card[], x: number, y: number, isActive: boolean) => {
      if (cards.length === 0) return;
      const text = formatHandValue(cards);
      const value = calculateHandValue(cards);
      const color = value.isBust ? 0xe74c3c : value.isBlackjack ? 0xf1c40f : 0xffffff;

      const label = new Text({
        text,
        style: new TextStyle({
          fontFamily: 'Arial',
          fontSize: 16,
          fontWeight: 'bold',
          fill: color,
          dropShadow: { color: 0x000000, blur: 3, distance: 1 },
        }),
      });
      label.anchor.set(0.5);
      label.x = x;
      label.y = y;
      gc.addChild(label);

      // Active hand glow indicator
      if (isActive) {
        const glow = new Graphics();
        glow.roundRect(x - 20, y - 12, 40, 24, 8);
        glow.fill({ color: 0xf1c40f, alpha: 0.15 });
        gc.addChild(glow);
      }
    },
    [],
  );

  const drawBetChips = useCallback((gc: Container, bet: number, x: number, y: number) => {
    if (bet <= 0) return;

    const chipColors = [0xe74c3c, 0x2ecc71, 0x3498db, 0xf1c40f, 0x9b59b6];
    const chipCount = Math.min(Math.ceil(bet / 25), 5);

    for (let i = 0; i < chipCount; i++) {
      const chip = new Graphics();
      chip.circle(0, 0, 10);
      chip.fill({ color: chipColors[i % chipColors.length] });
      chip.stroke({ color: 0xffffff, width: 1.5 });
      chip.x = x + (i - chipCount / 2) * 8;
      chip.y = y - i * 4;
      gc.addChild(chip);
    }

    const betLabel = new Text({
      text: `$${bet}`,
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 13,
        fontWeight: 'bold',
        fill: 0xffffff,
        dropShadow: { color: 0x000000, blur: 2, distance: 1 },
      }),
    });
    betLabel.anchor.set(0.5);
    betLabel.x = x;
    betLabel.y = y + 18;
    gc.addChild(betLabel);
  }, []);

  const renderGame = useCallback(
    (currentState: BJState) => {
      const app = appRef.current;
      const gc = gameContainerRef.current;
      if (!app || !gc) return;

      gc.removeChildren();
      drawTable(gc);

      // Draw deck
      const backTexture = getCardBackTexture(app);
      const deckSprite = new Sprite(backTexture);
      deckSprite.anchor.set(0.5);
      deckSprite.x = DECK_X;
      deckSprite.y = DECK_Y;
      deckSprite.width = CARD_WIDTH * 0.9;
      deckSprite.height = CARD_HEIGHT * 0.9;
      gc.addChild(deckSprite);

      // Draw dealer cards
      if (currentState.dealerCards.length > 0) {
        const dealerHandWidth = (currentState.dealerCards.length - 1) * HAND_CARD_SPACING;
        const dealerStartX = TABLE_CX - dealerHandWidth / 2;

        currentState.dealerCards.forEach((card, i) => {
          const faceUp = i === 0 || currentState.dealerHoleRevealed;
          drawCard(app, gc, card, dealerStartX + i * HAND_CARD_SPACING, DEALER_Y, faceUp);
        });

        // Dealer hand value
        if (currentState.dealerHoleRevealed) {
          drawHandValueLabel(gc, currentState.dealerCards, TABLE_CX, DEALER_Y - 58, false);
        } else {
          // Show only the visible card value
          const visibleValue = calculateHandValue([currentState.dealerCards[0]]);
          const label = new Text({
            text: `${visibleValue.best}`,
            style: new TextStyle({
              fontFamily: 'Arial',
              fontSize: 16,
              fontWeight: 'bold',
              fill: 0xffffff,
              dropShadow: { color: 0x000000, blur: 3, distance: 1 },
            }),
          });
          label.anchor.set(0.5);
          label.x = TABLE_CX;
          label.y = DEALER_Y - 58;
          gc.addChild(label);
        }

        // "DEALER" label
        const dealerLabel = new Text({
          text: 'DEALER',
          style: new TextStyle({
            fontFamily: 'Arial',
            fontSize: 12,
            fill: 0xaaaaaa,
            letterSpacing: 2,
          }),
        });
        dealerLabel.anchor.set(0.5);
        dealerLabel.x = TABLE_CX;
        dealerLabel.y = DEALER_Y - 78;
        gc.addChild(dealerLabel);
      }

      // Draw player hands
      const handCount = currentState.playerHands.length;
      currentState.playerHands.forEach((hand, handIdx) => {
        const hx = getPlayerHandX(handCount, handIdx);
        const handWidth = (hand.cards.length - 1) * HAND_CARD_SPACING;
        const startX = hx - handWidth / 2;

        hand.cards.forEach((card, cardIdx) => {
          drawCard(app, gc, card, startX + cardIdx * HAND_CARD_SPACING, PLAYER_Y, true);
        });

        // Hand value label
        const isActive = currentState.phase === BJPhase.PlayerTurn && handIdx === currentState.activeHandIndex;
        drawHandValueLabel(gc, hand.cards, hx, PLAYER_Y + 58, isActive);

        // Hand label for split
        if (handCount > 1) {
          const hlabel = new Text({
            text: `Hand ${handIdx + 1}`,
            style: new TextStyle({
              fontFamily: 'Arial',
              fontSize: 11,
              fill: isActive ? 0xf1c40f : 0x888888,
            }),
          });
          hlabel.anchor.set(0.5);
          hlabel.x = hx;
          hlabel.y = PLAYER_Y + 78;
          gc.addChild(hlabel);
        }

        // Bet chips
        drawBetChips(gc, hand.bet, hx, PLAYER_Y + 105);

        // Result label
        if (hand.result && currentState.phase === BJPhase.Settle) {
          const resultText = hand.result === 'playerBlackjack'
            ? 'BLACKJACK!'
            : hand.result === 'playerWin'
              ? 'WIN!'
              : hand.result === 'dealerBust'
                ? 'DEALER BUST!'
                : hand.result === 'push'
                  ? 'PUSH'
                  : hand.result === 'playerBust'
                    ? 'BUST'
                    : 'LOSE';
          const resultColor = ['playerBlackjack', 'playerWin', 'dealerBust'].includes(hand.result)
            ? 0x2ecc71
            : hand.result === 'push'
              ? 0xf1c40f
              : 0xe74c3c;

          const rl = new Text({
            text: resultText,
            style: new TextStyle({
              fontFamily: 'Arial',
              fontSize: 22,
              fontWeight: 'bold',
              fill: resultColor,
              dropShadow: { color: 0x000000, blur: 4, distance: 2 },
            }),
          });
          rl.anchor.set(0.5);
          rl.x = hx;
          rl.y = PLAYER_Y - 58;
          gc.addChild(rl);
        }
      });

      // "YOU" label
      if (handCount > 0) {
        const youLabel = new Text({
          text: 'YOU',
          style: new TextStyle({
            fontFamily: 'Arial',
            fontSize: 12,
            fill: 0xaaaaaa,
            letterSpacing: 2,
          }),
        });
        youLabel.anchor.set(0.5);
        youLabel.x = TABLE_CX;
        youLabel.y = PLAYER_Y + 130;
        gc.addChild(youLabel);
      }
    },
    [drawTable, drawCard, drawHandValueLabel, drawBetChips],
  );

  const playDealAnimation = useCallback(
    async (currentState: BJState) => {
      const app = appRef.current;
      const gc = gameContainerRef.current;
      if (!app || !gc || animatingRef.current) return;
      if (currentState.dealerCards.length === 0) return;

      animatingRef.current = true;
      useBlackjackStore.getState().setAnimating(true);

      // Clear and redraw table
      gc.removeChildren();
      drawTable(gc);

      // Draw deck
      const backTexture = getCardBackTexture(app);
      const deckSprite = new Sprite(backTexture);
      deckSprite.anchor.set(0.5);
      deckSprite.x = DECK_X;
      deckSprite.y = DECK_Y;
      deckSprite.width = CARD_WIDTH * 0.9;
      deckSprite.height = CARD_HEIGHT * 0.9;
      gc.addChild(deckSprite);

      const dealerCards = currentState.dealerCards;
      const playerCards = currentState.playerHands[0]?.cards ?? [];
      const handCount = currentState.playerHands.length;
      const hx = getPlayerHandX(handCount, 0);

      // Deal 4 cards: player, dealer, player, dealer
      const allCards: { card: Card; targetX: number; targetY: number; faceUp: boolean }[] = [];

      // Player card 1
      const pWidth0 = (playerCards.length - 1) * HAND_CARD_SPACING;
      const pStartX = hx - pWidth0 / 2;
      allCards.push({ card: playerCards[0], targetX: pStartX, targetY: PLAYER_Y, faceUp: true });

      // Dealer card 1
      const dWidth = (dealerCards.length - 1) * HAND_CARD_SPACING;
      const dStartX = TABLE_CX - dWidth / 2;
      allCards.push({ card: dealerCards[0], targetX: dStartX, targetY: DEALER_Y, faceUp: true });

      // Player card 2
      if (playerCards.length > 1) {
        allCards.push({ card: playerCards[1], targetX: pStartX + HAND_CARD_SPACING, targetY: PLAYER_Y, faceUp: true });
      }

      // Dealer card 2 (face down)
      if (dealerCards.length > 1) {
        allCards.push({ card: dealerCards[1], targetX: dStartX + HAND_CARD_SPACING, targetY: DEALER_Y, faceUp: false });
      }

      const sprites: Sprite[] = [];

      for (const item of allCards) {
        const sprite = new Sprite(backTexture);
        sprite.anchor.set(0.5);
        sprite.x = DECK_X;
        sprite.y = DECK_Y;
        sprite.width = CARD_WIDTH * 0.3;
        sprite.height = CARD_HEIGHT * 0.3;
        sprite.alpha = 0;
        gc.addChild(sprite);
        sprites.push(sprite);

        sprite.alpha = 1;
        playCardDeal();
        await tweenTo(sprite, {
          x: item.targetX,
          y: item.targetY,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          duration: 0.2,
          ease: 'power2.out',
        });

        if (item.faceUp) {
          playCardFlip();
          const faceTexture = getCardTexture(app, item.card);
          await animateFlip(sprite, faceTexture);
        }

        await delayMs(80);
      }

      animatingRef.current = false;
      useBlackjackStore.getState().setAnimating(false);

      // Re-render to show final state
      renderGame(useBlackjackStore.getState().state!);
    },
    [drawTable, renderGame],
  );

  const playHitAnimation = useCallback(
    async (currentState: BJState, handIndex: number, cardIndex: number) => {
      const app = appRef.current;
      const gc = gameContainerRef.current;
      if (!app || !gc || animatingRef.current) return;

      animatingRef.current = true;

      const hand = currentState.playerHands[handIndex];
      const card = hand.cards[cardIndex];
      const handCount = currentState.playerHands.length;
      const hx = getPlayerHandX(handCount, handIndex);
      const handWidth = (hand.cards.length - 1) * HAND_CARD_SPACING;
      const startX = hx - handWidth / 2;
      const targetX = startX + cardIndex * HAND_CARD_SPACING;

      const backTexture = getCardBackTexture(app);
      const sprite = new Sprite(backTexture);
      sprite.anchor.set(0.5);
      sprite.x = DECK_X;
      sprite.y = DECK_Y;
      sprite.width = CARD_WIDTH * 0.3;
      sprite.height = CARD_HEIGHT * 0.3;
      sprite.alpha = 0;
      gc.addChild(sprite);

      sprite.alpha = 1;
      await tweenTo(sprite, {
        x: targetX,
        y: PLAYER_Y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        duration: 0.2,
        ease: 'power2.out',
      });

      const faceTexture = getCardTexture(app, card);
      playCardFlip();
      await animateFlip(sprite, faceTexture);

      animatingRef.current = false;

      // Re-render
      renderGame(useBlackjackStore.getState().state!);
    },
    [renderGame],
  );

  const playDealerAnimation = useCallback(
    async (currentState: BJState, prevDealerCount: number) => {
      const app = appRef.current;
      const gc = gameContainerRef.current;
      if (!app || !gc) return;

      const newCards = currentState.dealerCards.slice(prevDealerCount);
      if (newCards.length === 0) return;

      for (let i = 0; i < newCards.length; i++) {
        const cardIdx = prevDealerCount + i;
        const dWidth = (currentState.dealerCards.length - 1) * HAND_CARD_SPACING;
        const dStartX = TABLE_CX - dWidth / 2;
        const targetX = dStartX + cardIdx * HAND_CARD_SPACING;

        const backTexture = getCardBackTexture(app);
        const sprite = new Sprite(backTexture);
        sprite.anchor.set(0.5);
        sprite.x = DECK_X;
        sprite.y = DECK_Y;
        sprite.width = CARD_WIDTH * 0.3;
        sprite.height = CARD_HEIGHT * 0.3;
        sprite.alpha = 0;
        gc.addChild(sprite);

        sprite.alpha = 1;
        await tweenTo(sprite, {
          x: targetX,
          y: DEALER_Y,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          duration: 0.2,
          ease: 'power2.out',
        });

        const faceTexture = getCardTexture(app, newCards[i]);
        playCardFlip();
        await animateFlip(sprite, faceTexture);

        await delayMs(100);
      }
    },
    [],
  );

  // Init Pixi app
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    const app = new Application();
    const initPromise = app.init({
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      background: 0x0a0a0a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      resizeTo: undefined,
    });

    initPromise.then(() => {
      if (cancelled || !containerRef.current) return;
      containerRef.current.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;

      const gc = new Container();
      app.stage.addChild(gc);
      gameContainerRef.current = gc;

      // Initial render
      const currentState = useBlackjackStore.getState().state;
      if (currentState) {
        renderGame(currentState);
      }
    });

    return () => {
      cancelled = true;
      clearTextureCache();
      initPromise.then(() => {
        app.destroy(true);
      });
      appRef.current = null;
      gameContainerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render on state changes
  useEffect(() => {
    if (!state || !appRef.current) return;

    const prevPhase = prevPhaseRef.current;
    const prevDealerCount = prevDealerCountRef.current;
    const prevPlayerCards = prevPlayerCardsRef.current;

    // Update refs
    prevPhaseRef.current = state.phase;
    prevDealerCountRef.current = state.dealerCards.length;
    prevPlayerCardsRef.current = state.playerHands.map((h) => h.cards.length);

    // Deal animation
    if (state.phase === BJPhase.PlayerTurn && prevPhase === BJPhase.Dealing) {
      playDealAnimation(state);
      return;
    }

    // Hit animation: detect new card in player hand
    if (state.phase === BJPhase.PlayerTurn || state.phase === BJPhase.DealerTurn || state.phase === BJPhase.Settle) {
      for (let i = 0; i < state.playerHands.length; i++) {
        const prevCount = prevPlayerCards[i] ?? 0;
        const currCount = state.playerHands[i].cards.length;
        if (currCount > prevCount && prevPhase === BJPhase.PlayerTurn) {
          playHitAnimation(state, i, currCount - 1);
          return;
        }
      }
    }

    // Dealer draw animation
    if (state.dealerCards.length > prevDealerCount && prevDealerCount >= 2) {
      // Render base state first, then animate new cards
      renderGame(state);
      playDealerAnimation(state, prevDealerCount);
      return;
    }

    renderGame(state);
  }, [state, renderGame, playDealAnimation, playHitAnimation, playDealerAnimation]);

  return (
    <div
      ref={containerRef}
      className="w-full flex justify-center"
      style={{ maxWidth: CANVAS_WIDTH }}
    />
  );
}
