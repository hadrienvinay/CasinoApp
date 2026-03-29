import { Phase, PokerVariant } from './types';

export interface VariantRules {
  holeCardCount: number;       // 2 for holdem, 4 for omaha, 5 for draw, 7 for razz (dealt over streets)
  initialDealCount: number;    // how many cards dealt initially
  hasCommunityCards: boolean;
  maxDrawRounds: number;       // 0 for holdem/omaha, 1 for 5-card draw, 3 for triple draw
  phaseSequence: Phase[];      // the ordered phases for this variant
  isLowball: boolean;          // razz and 2-7 triple draw
  evaluationType: 'high' | 'omaha' | 'razz' | '27low';
}

export function getVariantRules(variant: PokerVariant): VariantRules {
  switch (variant) {
    case PokerVariant.TexasHoldem:
      return {
        holeCardCount: 2,
        initialDealCount: 2,
        hasCommunityCards: true,
        maxDrawRounds: 0,
        phaseSequence: [Phase.PreFlop, Phase.Flop, Phase.Turn, Phase.River],
        isLowball: false,
        evaluationType: 'high',
      };

    case PokerVariant.Omaha:
      return {
        holeCardCount: 4,
        initialDealCount: 4,
        hasCommunityCards: true,
        maxDrawRounds: 0,
        phaseSequence: [Phase.PreFlop, Phase.Flop, Phase.Turn, Phase.River],
        isLowball: false,
        evaluationType: 'omaha',
      };

    case PokerVariant.Razz:
      // Simplified Razz: deal 5 cards, bet, deal 2 more, bet, showdown
      return {
        holeCardCount: 7,
        initialDealCount: 5,
        hasCommunityCards: false,
        maxDrawRounds: 0,
        phaseSequence: [Phase.PreFlop, Phase.Turn],
        isLowball: true,
        evaluationType: 'razz',
      };

    case PokerVariant.TripleDraw27:
      // 5 hole, 3 draw rounds with betting between each
      // PreFlop → Draw1 → Flop(bet) → Draw2 → Turn(bet) → Draw3 → River(bet) → Showdown
      return {
        holeCardCount: 5,
        initialDealCount: 5,
        hasCommunityCards: false,
        maxDrawRounds: 3,
        phaseSequence: [Phase.PreFlop, Phase.Draw1, Phase.Flop, Phase.Draw2, Phase.Turn, Phase.Draw3, Phase.River],
        isLowball: true,
        evaluationType: '27low',
      };

    case PokerVariant.FiveCardDraw:
      // 5 hole, 1 draw round with betting before and after
      // PreFlop → Draw1 → Flop(reuse as post-draw bet) → Showdown
      return {
        holeCardCount: 5,
        initialDealCount: 5,
        hasCommunityCards: false,
        maxDrawRounds: 1,
        phaseSequence: [Phase.PreFlop, Phase.Draw1, Phase.Flop],
        isLowball: false,
        evaluationType: 'high',
      };

    default:
      return getVariantRules(PokerVariant.TexasHoldem);
  }
}
