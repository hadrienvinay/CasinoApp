import gsap from 'gsap';

/**
 * Wraps gsap.to() in a Promise that resolves when the tween completes.
 */
export function tweenTo(
  target: object,
  props: gsap.TweenVars,
): Promise<void> {
  return new Promise((resolve) => {
    gsap.to(target, {
      ...props,
      onComplete: () => {
        if (props.onComplete) {
          (props.onComplete as () => void)();
        }
        resolve();
      },
    });
  });
}

/**
 * Run multiple animation promises in parallel, resolving when all finish.
 */
export function parallel(...promises: Promise<void>[]): Promise<void> {
  return Promise.all(promises).then(() => undefined);
}

/**
 * Run animation factory functions sequentially.
 * Each factory is called only after the previous one resolves.
 */
export async function sequence(
  ...fns: (() => Promise<void>)[]
): Promise<void> {
  for (const fn of fns) {
    await fn();
  }
}

/**
 * Promise-based delay.
 */
export function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
