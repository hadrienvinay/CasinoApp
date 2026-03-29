import { Application, Container, Sprite } from 'pixi.js';
import { getCardBackTexture, getCardTexture } from '@/lib/card-textures';
import { CARD_WIDTH, CARD_HEIGHT, SeatPosition } from '@/lib/positions';
import { Player } from '@/engine/types';
import { tweenTo, delayMs } from './tween-manager';
import { animateFlip } from './flip';
import { playCardDeal, playCardFlip } from '@/lib/sounds';

/**
 * Animate dealing cards from the deck to each player's seat.
 * Cards fly in an arc with rotation and scale, then human cards flip face-up.
 */
export async function animateDeal(
  app: Application,
  container: Container,
  players: Player[],
  seats: SeatPosition[],
  deckPosition: { x: number; y: number },
): Promise<void> {
  const humanSprites: { sprite: Sprite; player: Player }[] = [];

  // Deal 2 rounds: first card to each player, then second card
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (player.isFolded) continue;

      const seat = seats[i];
      const backTexture = getCardBackTexture(app);
      const sprite = new Sprite(backTexture);
      sprite.anchor.set(0.5);
      sprite.x = deckPosition.x;
      sprite.y = deckPosition.y;
      sprite.width = CARD_WIDTH * 0.3;
      sprite.height = CARD_HEIGHT * 0.3;
      sprite.alpha = 0;
      sprite.rotation = 0;
      container.addChild(sprite);

      // Target position: offset for first/second card
      const cardOffset = (round - 0.5) * (CARD_WIDTH * 0.7);
      const targetX = seat.x + cardOffset;
      const targetY = seat.y;

      // Slight random rotation for natural feel
      const targetRotation = (Math.random() - 0.5) * 0.08;

      // Fly to seat with scale and rotation
      sprite.alpha = 1;
      playCardDeal();
      await tweenTo(sprite, {
        x: targetX,
        y: targetY,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        rotation: targetRotation,
        duration: 0.18,
        ease: 'power2.out',
      });

      if (player.isHuman && player.holeCards) {
        humanSprites.push({ sprite, player });
      }

      await delayMs(40);
    }
  }

  // Flip human player's cards face-up
  for (const { sprite, player } of humanSprites) {
    if (!player.holeCards) continue;
    const cardIndex = humanSprites.indexOf(
      humanSprites.find((h) => h.sprite === sprite)!,
    );
    const card = player.holeCards[cardIndex];
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
