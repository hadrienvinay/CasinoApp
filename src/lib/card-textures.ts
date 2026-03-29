import { Graphics, Text, TextStyle, Container, Texture, Application } from 'pixi.js';
import { Rank, Suit, Card } from '@/engine/types';
import { CARD_WIDTH, CARD_HEIGHT } from './positions';

const SUIT_COLORS: Record<string, number> = {
  [Suit.Hearts]: 0xe74c3c,
  [Suit.Diamonds]: 0xe74c3c,
  [Suit.Clubs]: 0x2c3e50,
  [Suit.Spades]: 0x2c3e50,
};

const SUIT_SYMBOLS: Record<string, string> = {
  [Suit.Hearts]: '♥',
  [Suit.Diamonds]: '♦',
  [Suit.Clubs]: '♣',
  [Suit.Spades]: '♠',
};

const RANK_DISPLAY: Record<string, string> = {
  [Rank.Two]: '2',
  [Rank.Three]: '3',
  [Rank.Four]: '4',
  [Rank.Five]: '5',
  [Rank.Six]: '6',
  [Rank.Seven]: '7',
  [Rank.Eight]: '8',
  [Rank.Nine]: '9',
  [Rank.Ten]: '10',
  [Rank.Jack]: 'J',
  [Rank.Queen]: 'Q',
  [Rank.King]: 'K',
  [Rank.Ace]: 'A',
};

const textureCache = new Map<string, Texture>();

export function getCardTexture(app: Application, card: Card): Texture {
  const key = `${card.rank}${card.suit}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const container = new Container();
  const color = SUIT_COLORS[card.suit];

  // Card background
  const bg = new Graphics();
  bg.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 6);
  bg.fill({ color: 0xffffff });
  bg.stroke({ color: 0xcccccc, width: 1 });
  container.addChild(bg);

  // Rank text
  const rankStyle = new TextStyle({
    fontFamily: 'Arial',
    fontSize: 16,
    fontWeight: 'bold',
    fill: color,
  });
  const rankText = new Text({ text: RANK_DISPLAY[card.rank], style: rankStyle });
  rankText.x = 5;
  rankText.y = 3;
  container.addChild(rankText);

  // Suit symbol (top-left)
  const suitStyle = new TextStyle({
    fontFamily: 'Arial',
    fontSize: 12,
    fill: color,
  });
  const suitText = new Text({ text: SUIT_SYMBOLS[card.suit], style: suitStyle });
  suitText.x = 5;
  suitText.y = 20;
  container.addChild(suitText);

  // Big center suit
  const centerStyle = new TextStyle({
    fontFamily: 'Arial',
    fontSize: 28,
    fill: color,
  });
  const centerSuit = new Text({ text: SUIT_SYMBOLS[card.suit], style: centerStyle });
  centerSuit.anchor.set(0.5);
  centerSuit.x = CARD_WIDTH / 2;
  centerSuit.y = CARD_HEIGHT / 2 + 4;
  container.addChild(centerSuit);

  const texture = app.renderer.generateTexture(container);
  textureCache.set(key, texture);
  container.destroy();

  return texture;
}

let cardBackTexture: Texture | null = null;

export function getCardBackTexture(app: Application): Texture {
  if (cardBackTexture) return cardBackTexture;

  const container = new Container();

  const bg = new Graphics();
  bg.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 6);
  bg.fill({ color: 0x2980b9 });
  bg.stroke({ color: 0x1a5276, width: 1 });
  container.addChild(bg);

  // Diamond pattern
  const pattern = new Graphics();
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 4; col++) {
      const cx = 10 + col * 14;
      const cy = 10 + row * 12;
      pattern.moveTo(cx, cy - 4);
      pattern.lineTo(cx + 4, cy);
      pattern.lineTo(cx, cy + 4);
      pattern.lineTo(cx - 4, cy);
      pattern.closePath();
      pattern.fill({ color: 0x3498db, alpha: 0.5 });
    }
  }
  container.addChild(pattern);

  cardBackTexture = app.renderer.generateTexture(container);
  container.destroy();

  return cardBackTexture;
}

export function clearTextureCache() {
  textureCache.forEach((t) => t.destroy());
  textureCache.clear();
  if (cardBackTexture) {
    cardBackTexture.destroy();
    cardBackTexture = null;
  }
}
