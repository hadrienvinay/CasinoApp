import { Application, Container, Sprite } from 'pixi.js';
import { getCardTexture, getCardBackTexture } from '@/lib/card-textures';
import {
  COMMUNITY_CARDS_START_X,
  COMMUNITY_CARDS_Y,
  COMMUNITY_CARD_SPACING,
  CARD_WIDTH,
  CARD_HEIGHT,
  DECK_POSITION,
} from '@/lib/positions';
import { Card } from '@/engine/types';
import { tweenTo, delayMs } from './tween-manager';
import { animateFlip } from './flip';
import { playCardDeal, playCardFlip } from '@/lib/sounds';

/**
 * Deal a single card from the deck to a community card position, then flip it.
 * Includes scale-up and slight bounce on arrival.
 */
async function dealAndFlipCard(
  app: Application,
  container: Container,
  card: Card,
  index: number,
): Promise<Sprite> {
  const targetX = COMMUNITY_CARDS_START_X + index * COMMUNITY_CARD_SPACING;
  const targetY = COMMUNITY_CARDS_Y;

  const backTexture = getCardBackTexture(app);
  const sprite = new Sprite(backTexture);
  sprite.anchor.set(0.5);
  sprite.x = DECK_POSITION.x;
  sprite.y = DECK_POSITION.y;
  sprite.width = CARD_WIDTH * 0.4;
  sprite.height = CARD_HEIGHT * 0.4;
  sprite.alpha = 0;
  container.addChild(sprite);

  // Slide from deck to position with scale-up
  sprite.alpha = 1;
  playCardDeal();
  await tweenTo(sprite, {
    x: targetX,
    y: targetY - 8,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    duration: 0.25,
    ease: 'power2.out',
  });

  // Settle bounce
  await tweenTo(sprite, {
    y: targetY,
    duration: 0.12,
    ease: 'bounce.out',
  });

  // Flip to face-up
  playCardFlip();
  const faceTexture = getCardTexture(app, card);
  await animateFlip(sprite, faceTexture);

  return sprite;
}

/**
 * Animate the flop: 3 cards slide in from deck face-down, then flip one by one.
 */
export async function animateFlop(
  app: Application,
  container: Container,
  cards: Card[],
): Promise<Sprite[]> {
  const sprites: Sprite[] = [];
  const backTexture = getCardBackTexture(app);

  // First, slide all 3 cards face-down to their positions
  const slidePromises: Promise<void>[] = [];
  for (let i = 0; i < 3 && i < cards.length; i++) {
    const targetX = COMMUNITY_CARDS_START_X + i * COMMUNITY_CARD_SPACING;
    const targetY = COMMUNITY_CARDS_Y;

    const sprite = new Sprite(backTexture);
    sprite.anchor.set(0.5);
    sprite.x = DECK_POSITION.x;
    sprite.y = DECK_POSITION.y;
    sprite.width = CARD_WIDTH * 0.4;
    sprite.height = CARD_HEIGHT * 0.4;
    sprite.alpha = 0;
    container.addChild(sprite);
    sprites.push(sprite);

    sprite.alpha = 1;
    const stagger = i * 60;
    slidePromises.push(
      delayMs(stagger).then(() => {
        playCardDeal();
        return tweenTo(sprite, {
          x: targetX,
          y: targetY,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          duration: 0.3,
          ease: 'power3.out',
        });
      }),
    );
  }
  await Promise.all(slidePromises);

  await delayMs(100);

  // Then flip each card one by one
  for (let i = 0; i < sprites.length; i++) {
    playCardFlip();
    const faceTexture = getCardTexture(app, cards[i]);
    await animateFlip(sprites[i], faceTexture);
    if (i < sprites.length - 1) {
      await delayMs(80);
    }
  }

  return sprites;
}

/**
 * Animate a turn or river card: slide from deck with overshoot, then flip.
 */
export async function animateTurnOrRiver(
  app: Application,
  container: Container,
  card: Card,
  index: number,
): Promise<Sprite> {
  return dealAndFlipCard(app, container, card, index);
}
