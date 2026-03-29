import { Application, Container, Sprite, Texture } from 'pixi.js';
import { getCardTexture, getCardBackTexture } from '@/lib/card-textures';
import { CARD_WIDTH, CARD_HEIGHT } from '@/lib/positions';
import { Card } from '@/engine/types';
import { tweenTo, delayMs } from './tween-manager';

/**
 * Flip a single card sprite: scale X to 0, swap texture, scale back with a pop.
 */
export async function animateFlip(
  sprite: Sprite,
  newTexture: Texture,
): Promise<void> {
  const originalScaleX = sprite.scale.x;
  const originalScaleY = sprite.scale.y;

  // Scale X to 0 (card appears edge-on)
  await tweenTo(sprite.scale, {
    x: 0,
    duration: 0.12,
    ease: 'power2.in',
  });

  // Swap texture at the midpoint
  sprite.texture = newTexture;

  // Scale X back with a slight overshoot for pop effect
  await tweenTo(sprite.scale, {
    x: originalScaleX * 1.08,
    y: originalScaleY * 1.04,
    duration: 0.1,
    ease: 'power2.out',
  });

  // Settle to original scale
  await tweenTo(sprite.scale, {
    x: originalScaleX,
    y: originalScaleY,
    duration: 0.08,
    ease: 'power1.inOut',
  });
}

/**
 * Flip multiple cards with stagger.
 */
export async function animateFlipCards(
  app: Application,
  container: Container,
  cards: Card[],
  positions: { x: number; y: number }[],
): Promise<Sprite[]> {
  const sprites: Sprite[] = [];

  for (let i = 0; i < cards.length; i++) {
    const pos = positions[i];
    const backTexture = getCardBackTexture(app);
    const sprite = new Sprite(backTexture);
    sprite.anchor.set(0.5);
    sprite.x = pos.x;
    sprite.y = pos.y;
    sprite.width = CARD_WIDTH;
    sprite.height = CARD_HEIGHT;
    container.addChild(sprite);
    sprites.push(sprite);
  }

  for (let i = 0; i < cards.length; i++) {
    const faceTexture = getCardTexture(app, cards[i]);
    await animateFlip(sprites[i], faceTexture);
    if (i < cards.length - 1) {
      await delayMs(100);
    }
  }

  return sprites;
}
