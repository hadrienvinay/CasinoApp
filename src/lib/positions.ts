export interface SeatPosition {
  x: number;
  y: number;
  labelAnchor: 'top' | 'bottom';
}

// Positions for seats around an elliptical table
// Canvas is 1280x720, table centered at 640x340
const TABLE_CENTER_X = 640;
const TABLE_CENTER_Y = 310;
const RADIUS_X = 440;
const RADIUS_Y = 210;

/**
 * @param playerCount Number of players
 * @param localPlayerIndex Index of the local player to place at the bottom (default 0)
 */
export function getSeatPositions(playerCount: number, localPlayerIndex = 0): SeatPosition[] {
  const positions: SeatPosition[] = [];

  for (let i = 0; i < playerCount; i++) {
    // Offset so that localPlayerIndex sits at the bottom (angle π/2)
    const slot = (i - localPlayerIndex + playerCount) % playerCount;
    const angle = (Math.PI / 2) + (2 * Math.PI * slot) / playerCount;
    const x = TABLE_CENTER_X + RADIUS_X * Math.cos(angle);
    const y = TABLE_CENTER_Y + RADIUS_Y * Math.sin(angle);

    positions.push({
      x,
      y,
      labelAnchor: y > TABLE_CENTER_Y ? 'bottom' : 'top',
    });
  }

  return positions;
}

export const COMMUNITY_CARDS_Y = 300;
export const COMMUNITY_CARDS_START_X = 480;
export const COMMUNITY_CARD_SPACING = 80;

export const CARD_WIDTH = 60;
export const CARD_HEIGHT = 84;

export const DECK_POSITION = { x: 780, y: 165 };
