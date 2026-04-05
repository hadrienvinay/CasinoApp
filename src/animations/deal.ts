import { Application, Container, Sprite } from 'pixi.js';
import { getCardBackTexture, getCardTexture } from '@/lib/card-textures';
import { CARD_WIDTH, CARD_HEIGHT, SeatPosition } from '@/lib/positions';
import { Player } from '@/engine/types';
import { tweenTo, delayMs } from './tween-manager';
import { animateFlip } from './flip';
import { playCardDeal, playCardFlip } from '@/lib/sounds';

/**
 * Animate dealing cards from the deck to each player's seat.
 * Cards fly in an arc with rotation and scale, then local player's cards flip face-up.
 * Supports any number of hole cards (2 for Hold'em, 4 for Omaha, 5 for draw/razz).
 */
export async function animateDeal(
  app: Application,
  container: Container,
  players: Player[],
  seats: SeatPosition[],
  deckPosition: { x: number; y: number },
  localPlayerId?: string,
): Promise<void> {
  const localSprites: { sprite: Sprite; cardRound: number }[] = [];
  const localPlayer = players.find((p) =>
    localPlayerId ? p.id === localPlayerId : p.isHuman,
  );

  // Determine how many cards to deal based on the first non-folded player's hole cards
  const samplePlayer = players.find((p) => !p.isFolded && p.holeCards);
  const cardCount = samplePlayer?.holeCards?.length ?? 2;

  // Adjust card sizes for many cards
  let cardW = CARD_WIDTH;
  if (cardCount === 4) cardW = CARD_WIDTH * 0.85;
  else if (cardCount >= 5) cardW = CARD_WIDTH * 0.75;
  const cardH = cardW * (CARD_HEIGHT / CARD_WIDTH);
  const spacing = cardW * 0.7;

  for (let round = 0; round < cardCount; round++) {
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (player.isFolded) continue;

      const seat = seats[i];
      const backTexture = getCardBackTexture(app);
      const sprite = new Sprite(backTexture);
      sprite.anchor.set(0.5);
      sprite.x = deckPosition.x;
      sprite.y = deckPosition.y;
      sprite.width = cardW * 0.3;
      sprite.height = cardH * 0.3;
      sprite.alpha = 0;
      sprite.rotation = 0;
      container.addChild(sprite);

      // Position: center the group of cards around the seat
      const totalWidth = (cardCount - 1) * spacing;
      const cardOffset = round * spacing - totalWidth / 2;
      const targetX = seat.x + cardOffset;
      const targetY = seat.y;

      const targetRotation = (Math.random() - 0.5) * 0.08;

      sprite.alpha = 1;
      playCardDeal();
      await tweenTo(sprite, {
        x: targetX,
        y: targetY,
        width: cardW,
        height: cardH,
        rotation: targetRotation,
        duration: 0.18,
        ease: 'power2.out',
      });

      if (player === localPlayer && player.holeCards) {
        localSprites.push({ sprite, cardRound: round });
      }

      await delayMs(40);
    }
  }

  // Flip only the local player's cards face-up
  for (const { sprite, cardRound } of localSprites) {
    if (!localPlayer?.holeCards) continue;
    const card = localPlayer.holeCards[cardRound];
    if (!card) continue;

    const faceTexture = getCardTexture(app, card);
    sprite.rotation = 0;
    playCardFlip();
    await animateFlip(sprite, faceTexture);
    await delayMs(60);
  }
}

/**
 * Remove deal animation sprites from the container.
 */
export function cleanupDealSprites(sprites: Sprite[]): void {
  sprites.forEach((s) => {
    if (!s.destroyed) s.destroy();
  });
}
