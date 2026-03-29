import gsap from 'gsap';
import { Container, Graphics } from 'pixi.js';
import { SeatPosition } from '@/lib/positions';

/**
 * Animate a showdown highlight: pulse/glow effect on winning player(s).
 * Uses gsap yoyo + repeat for a pulsing ring around the winner.
 */
export async function animateShowdown(
  container: Container,
  winnerIndices: number[],
  seats: SeatPosition[],
): Promise<void> {
  const rings: Graphics[] = [];

  for (const idx of winnerIndices) {
    const seat = seats[idx];
    if (!seat) continue;

    const ring = new Graphics();
    ring.circle(0, 0, 45);
    ring.stroke({ color: 0xf1c40f, width: 3 });
    ring.x = seat.x;
    ring.y = seat.y;
    ring.alpha = 0;
    container.addChild(ring);
    rings.push(ring);
  }

  // Pulse animation: fade in, then yoyo pulse 3 times
  const promises = rings.map((ring) =>
    new Promise<void>((resolve) => {
      gsapPulse(ring, resolve);
    }),
  );

  await Promise.all(promises);

  // Clean up rings
  rings.forEach((r) => {
    if (!r.destroyed) r.destroy();
  });
}

function gsapPulse(ring: Graphics, onDone: () => void): void {
  const tl = gsap.timeline({ onComplete: onDone });

  // Fade in
  tl.to(ring, {
    alpha: 1,
    duration: 0.3,
    ease: 'power1.out',
  });

  // Pulse scale and alpha with yoyo
  tl.to(ring.scale, {
    x: 1.15,
    y: 1.15,
    duration: 0.4,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: 3,
  }, '<');

  tl.to(ring, {
    alpha: 0.3,
    duration: 0.4,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: 3,
  }, '<');

  // Fade out
  tl.to(ring, {
    alpha: 0,
    duration: 0.2,
  });
}
