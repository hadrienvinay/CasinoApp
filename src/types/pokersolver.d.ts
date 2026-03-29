declare module 'pokersolver' {
  export class Hand {
    name: string;
    rank: number;
    cards: { toString(): string }[];
    static solve(cards: string[]): Hand;
    static winners(hands: Hand[]): Hand[];
  }
}
