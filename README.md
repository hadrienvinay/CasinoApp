# CasinoApp

A full-featured casino web app with **Texas Hold'em Poker**, **Blackjack**, and **real-time multiplayer** support.

Built with Next.js 14, Pixi.js v8, GSAP, Socket.io, and Zustand.

## Features

### Poker (Texas Hold'em)
- Play against 2-8 AI opponents with 3 difficulty levels
- **Easy**: random play
- **Medium**: hand tiers, pot odds, short stack push/fold, 3-bet logic, semi-bluffs
- **Hard**: position-aware play, opponent modeling, bluffing on scary boards, steal attempts, 4-bet/5-bet ranges, check-raise bluffs
- Side pot calculation with correct all-in logic
- Card deal, community card, chip collection, and winner payout animations
- Hand history log, dealer/SB/BB buttons
- Toggle to show opponent hands (debug) or display stacks in BB

### Blackjack
- Standard rules: hit, stand, double down, split
- Card-by-card dealing with pauses
- Dealer draws to 17, checks for blackjack
- Bet selection screen, chip animations

### Multiplayer Poker
- Create a room, share the link, play with friends
- Server-authoritative architecture (game engine runs on server)
- Real-time communication via Socket.io
- 30s turn timer with auto-fold
- All-in runout with automatic dealing
- Disconnect/reconnect handling (60s grace period)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Rendering | Pixi.js v8 (canvas), GSAP (animations) |
| State | Zustand (with localStorage persistence) |
| Multiplayer | Socket.io, Express custom server |
| Audio | Web Audio API (procedural sounds) |
| Styling | Tailwind CSS |
| Testing | Vitest |

## Getting Started

```bash
# Install dependencies
npm install

# Run development server (includes multiplayer WebSocket server)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
  ai/              # AI strategies (easy, medium, hard) + hand evaluator
  animations/      # GSAP animations (deal, flip, chips, showdown)
  app/             # Next.js pages (game, blackjack, multiplayer)
  blackjack/       # Blackjack engine (types, hand-value, game-machine)
  engine/          # Poker engine (types, deck, betting, game-machine, pot)
  lib/             # Shared utilities (positions, card textures, sounds, socket)
  multiplayer/     # Server-side multiplayer (room-manager, game-controller)
  pixi/            # Pixi.js canvas components (PokerCanvas, BlackjackCanvas)
  store/           # Zustand stores (game, blackjack, multiplayer)
  ui/              # React UI components (ActionBar, HUD, menus, lobbies)
server.ts          # Custom Express + Socket.io server
```

## Scripts

| Command | Description |
|---------|------------|
| `npm run dev` | Start dev server with hot reload + WebSocket |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx vitest run` | Run tests |

## Deployment

This app uses a custom Express server for WebSocket support, so **Vercel is not compatible** with the multiplayer feature (serverless, no persistent connections).

Recommended platforms:
- **Railway** - push to deploy, supports custom Node.js servers
- **Render** - similar, with free tier
- **Fly.io** - Docker-based, performant

The app reads `process.env.PORT` automatically.
