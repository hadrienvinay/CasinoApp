import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { SeatPosition } from '@/lib/positions';
import { Player } from '@/engine/types';
import { tweenTo } from './tween-manager';
import { playChipBet, playChipsWin } from '@/lib/sounds';

const CHIP_COLORS = [0xe74c3c, 0x2ecc71, 0x3498db, 0xf1c40f, 0x9b59b6];
const TABLE_CX = 640;
const TABLE_CY = 340;

/**
 * Animate a bet: create chip graphics at a player's seat and slide them
 * toward the bet position near the table center.
 */
export async function animateBetToTable(
  container: Container,
  fromSeat: SeatPosition,
  toPosition: { x: number; y: number },
  amount: number,
  bigBlind: number,
): Promise<void> {
  const chipCount = Math.min(Math.ceil(amount / (bigBlind || 10)), 5);
  const chips: Graphics[] = [];

  for (let c = 0; c < chipCount; c++) {
    const chip = new Graphics();
    chip.circle(0, 0, 8);
    chip.fill({ color: CHIP_COLORS[c % CHIP_COLORS.length] });
    chip.stroke({ color: 0xffffff, width: 1 });
    chip.x = fromSeat.x;
    chip.y = fromSeat.y;
    container.addChild(chip);
    chips.push(chip);
  }

  // Animate chips sliding to bet position with stagger
  playChipBet();
  const promises = chips.map((chip, c) =>
    tweenTo(chip, {
      x: toPosition.x + (c - chipCount / 2) * 6,
      y: toPosition.y - c * 4,
      delay: c * 0.05,
      duration: 0.3,
      ease: 'power2.out',
    }),
  );

  await Promise.all(promises);
}

/**
 * Animate chips from the pot position to the winner's seat.
 * Duration: ~0.6s with stagger.
 */
export async function animateChipsToWinner(
  container: Container,
  potPosition: { x: number; y: number },
  winnerSeat: SeatPosition,
  amount: number,
): Promise<void> {
  const chipCount = 6;
  const chips: Graphics[] = [];

  // Show amount label
  const potLabel = new Text({
    text: `+$${amount}`,
    style: new TextStyle({
      fontFamily: 'Arial',
      fontSize: 20,
      fontWeight: 'bold',
      fill: 0xf1c40f,
      dropShadow: { color: 0x000000, blur: 4, distance: 2 },
    }),
  });
  potLabel.anchor.set(0.5);
  potLabel.x = potPosition.x;
  potLabel.y = potPosition.y;
  container.addChild(potLabel);

  for (let c = 0; c < chipCount; c++) {
    const chip = new Graphics();
    chip.circle(0, 0, 8);
    chip.fill({ color: CHIP_COLORS[c % CHIP_COLORS.length] });
    chip.stroke({ color: 0xffffff, width: 1 });
    chip.x = potPosition.x + (c - chipCount / 2) * 6;
    chip.y = potPosition.y + 15;
    container.addChild(chip);
    chips.push(chip);
  }

  // Animate chips to winner with stagger
  playChipsWin();
  const chipPromises = chips.map((chip, c) =>
    tweenTo(chip, {
      x: winnerSeat.x,
      y: winnerSeat.y,
      delay: 0.3 + c * 0.08,
      duration: 0.6,
      ease: 'power2.in',
      onComplete: () => {
        if (!chip.destroyed) chip.destroy();
      },
    }),
  );

  // Fade out pot label
  const labelPromise = tweenTo(potLabel, {
    alpha: 0,
    delay: 0.8,
    duration: 0.4,
    onComplete: () => {
      if (!potLabel.destroyed) potLabel.destroy();
    },
  });

  await Promise.all([...chipPromises, labelPromise]);
}

/**
 * Collect all player bets into the pot center.
 * For each player with a currentBet, animate chip stacks from their bet
 * position toward the pot.
 */
export async function animateChipsToPot(
  container: Container,
  seats: SeatPosition[],
  players: Player[],
  potPosition: { x: number; y: number },
): Promise<void> {
  const promises: Promise<void>[] = [];

  players.forEach((player, i) => {
    if (player.currentBet <= 0) return;

    const seat = seats[i];
    // Calculate bet position (offset toward table center)
    const dx = TABLE_CX - seat.x;
    const dy = TABLE_CY - seat.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const offsetDist = 70;
    const betX = seat.x + (dx / dist) * offsetDist;
    const betY = seat.y + (dy / dist) * offsetDist;

    const chipCount = Math.min(3, Math.ceil(player.currentBet / 10));
    for (let c = 0; c < chipCount; c++) {
      const chip = new Graphics();
      chip.circle(0, 0, 6);
      chip.fill({ color: CHIP_COLORS[c % CHIP_COLORS.length] });
      chip.stroke({ color: 0xffffff, width: 1 });
      chip.x = betX;
      chip.y = betY - c * 3;
      container.addChild(chip);

      promises.push(
        tweenTo(chip, {
          x: potPosition.x + (Math.random() - 0.5) * 20,
          y: potPosition.y + (Math.random() - 0.5) * 10,
          delay: c * 0.05,
          duration: 0.4,
          ease: 'power2.in',
          onComplete: () => {
            if (!chip.destroyed) chip.destroy();
          },
        }),
      );
    }
  });

  if (promises.length > 0) {
    await Promise.all(promises);
  }
}
