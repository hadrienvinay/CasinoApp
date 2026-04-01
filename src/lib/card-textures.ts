import { Graphics, Text, TextStyle, Container, Texture, Application, Rectangle } from 'pixi.js';
import { Rank, Suit, Card } from '@/engine/types';
import { CARD_WIDTH, CARD_HEIGHT } from './positions';

// Internal scale factor for crisp textures on large/HiDPI screens
const TEX_SCALE = 3;
const W = CARD_WIDTH * TEX_SCALE;   // 180
const H = CARD_HEIGHT * TEX_SCALE;  // 252
const R = 8 * TEX_SCALE;            // corner radius

const SUIT_COLORS: Record<string, number> = {
  [Suit.Hearts]: 0xd63031,
  [Suit.Diamonds]: 0xd63031,
  [Suit.Clubs]: 0x2d3436,
  [Suit.Spades]: 0x2d3436,
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
  bg.roundRect(0, 0, W, H, R);
  bg.fill({ color: 0xfafafa });
  bg.stroke({ color: 0xd0d0d0, width: TEX_SCALE });
  container.addChild(bg);

  // Inner border
  const m = 4 * TEX_SCALE;
  const inner = new Graphics();
  inner.roundRect(m, m, W - 2 * m, H - 2 * m, R - 4);
  inner.stroke({ color: 0xe8e8e8, width: 1 });
  container.addChild(inner);

  const rankDisplay = RANK_DISPLAY[card.rank];

  // Top-left rank (original ratio: 16px on 60px card)
  const rankStyle = new TextStyle({
    fontFamily: '"Georgia", "Times New Roman", serif',
    fontSize: 16 * TEX_SCALE,
    fontWeight: 'bold',
    fill: color,
  });
  const rankText = new Text({ text: rankDisplay, style: rankStyle });
  rankText.x = 5 * TEX_SCALE;
  rankText.y = 3 * TEX_SCALE;
  container.addChild(rankText);

  // Top-left suit (original ratio: 12px on 60px card)
  const smallSuitStyle = new TextStyle({
    fontFamily: 'Arial',
    fontSize: 12 * TEX_SCALE,
    fill: color,
  });
  const suitText = new Text({ text: SUIT_SYMBOLS[card.suit], style: smallSuitStyle });
  suitText.x = 5 * TEX_SCALE;
  suitText.y = 20 * TEX_SCALE;
  container.addChild(suitText);

  // Center suit (original ratio: 28px on 60px card)
  const centerStyle = new TextStyle({
    fontFamily: 'Arial',
    fontSize: 28 * TEX_SCALE,
    fill: color,
  });
  const centerSuit = new Text({ text: SUIT_SYMBOLS[card.suit], style: centerStyle });
  centerSuit.anchor.set(0.5);
  centerSuit.x = W / 2;
  centerSuit.y = H / 2 + 2 * TEX_SCALE;
  container.addChild(centerSuit);

  // Bottom-right rank (mirrored)
  const rankBottom = new Text({ text: rankDisplay, style: rankStyle });
  rankBottom.anchor.set(0.5);
  rankBottom.rotation = Math.PI;
  rankBottom.x = W - 5 * TEX_SCALE - rankText.width / 2;
  rankBottom.y = H - 3 * TEX_SCALE - rankText.height / 2;
  container.addChild(rankBottom);

  // Bottom-right suit (mirrored)
  const suitBottom = new Text({ text: SUIT_SYMBOLS[card.suit], style: smallSuitStyle });
  suitBottom.anchor.set(0.5);
  suitBottom.rotation = Math.PI;
  suitBottom.x = W - 5 * TEX_SCALE - suitText.width / 2;
  suitBottom.y = H - 20 * TEX_SCALE - suitText.height / 2;
  container.addChild(suitBottom);

  const texture = app.renderer.generateTexture({
    target: container,
    resolution: 1,
    frame: new Rectangle(0, 0, W, H),
  });
  textureCache.set(key, texture);
  container.destroy({ children: true });

  return texture;
}

let cardBackTexture: Texture | null = null;

export function getCardBackTexture(app: Application): Texture {
  if (cardBackTexture) return cardBackTexture;

  const container = new Container();

  // Background
  const bg = new Graphics();
  bg.roundRect(0, 0, W, H, R);
  bg.fill({ color: 0x1e3a5f });
  bg.stroke({ color: 0x152d4a, width: TEX_SCALE });
  container.addChild(bg);

  // Inner border
  const bm = 4 * TEX_SCALE;
  const border = new Graphics();
  border.roundRect(bm, bm, W - 2 * bm, H - 2 * bm, R - 4);
  border.stroke({ color: 0x2a6496, width: TEX_SCALE });
  container.addChild(border);

  // Diamond pattern
  const pattern = new Graphics();
  const spacingX = 14 * TEX_SCALE;
  const spacingY = 12 * TEX_SCALE;
  const dSize = 5 * TEX_SCALE;
  const cols = Math.floor((W - 2 * bm) / spacingX);
  const rows = Math.floor((H - 2 * bm) / spacingY);
  const offsetX = (W - cols * spacingX) / 2 + spacingX / 2;
  const offsetY = (H - rows * spacingY) / 2 + spacingY / 2;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = offsetX + col * spacingX;
      const cy = offsetY + row * spacingY;
      pattern.moveTo(cx, cy - dSize);
      pattern.lineTo(cx + dSize, cy);
      pattern.lineTo(cx, cy + dSize);
      pattern.lineTo(cx - dSize, cy);
      pattern.closePath();
      pattern.fill({ color: 0x3a7bc8, alpha: 0.4 });
    }
  }
  container.addChild(pattern);

  cardBackTexture = app.renderer.generateTexture({
    target: container,
    resolution: 1,
    frame: new Rectangle(0, 0, W, H),
  });
  container.destroy({ children: true });

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
