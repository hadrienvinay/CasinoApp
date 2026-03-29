# Texas Hold'em Poker - Plan d'implementation

## Context

Creer un jeu de poker Texas Hold'em jouable dans le navigateur contre des IA, avec des graphismes 2D stylises. Le projet sera dans un nouveau dossier `/Users/hadrienvinay/Documents/Code/Poker`.

**Stack**: Next.js 14 + Pixi.js v8 + @pixi/react + TypeScript + GSAP + Zustand

---

## Phase 1 - Setup projet & types (fondation)

```bash
mkdir -p /Users/hadrienvinay/Documents/Code/Poker
cd /Users/hadrienvinay/Documents/Code/Poker
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --no-import-alias
npm install pixi.js@^8 @pixi/react gsap zustand pokersolver
npm install -D @types/pokersolver vitest
```

Structure cible :
```
src/
├── app/              # Pages Next.js
├── engine/           # Logique pure TS (zero dependance UI)
├── ai/               # Strategies IA
├── store/            # Zustand stores
├── pixi/             # Composants Pixi.js ('use client')
├── animations/       # GSAP animations
├── ui/               # Composants React (overlay HTML/CSS)
├── lib/              # Utilitaires (positions, helpers)
└── types/            # Declarations de types
public/assets/        # Sprites cartes, jetons, table
```

Fichier cle : `src/engine/types.ts` - tous les types partages (Card, Player, GameState, Phase, ActionType, SidePot)

---

## Phase 2 - Moteur de jeu (`src/engine/`)

Logique pure TypeScript, **zero import React/Pixi/Zustand**. Testable en isolation.

| Fichier | Responsabilite |
|---|---|
| `types.ts` | Enums (Suit, Rank, Phase, ActionType), interfaces (Card, Player, GameState, SidePot) |
| `constants.ts` | Blinds, timing, positions |
| `deck.ts` | Deck 52 cartes, Fisher-Yates shuffle avec `crypto.getRandomValues()`, `deal(n)` |
| `hand-evaluator.ts` | Wrapper pokersolver : convertit Card interne → format pokersolver ("Ah", "Td"), expose `evaluateHand()` et `compareHands()` |
| `pot.ts` | Gestion pot principal + side pots (all-in a differents montants), distribution aux gagnants |
| `betting.ts` | Validation actions (check/call/raise/fold/all-in), min raise, detection fin de tour, `getAvailableActions()` |
| `game-machine.ts` | Machine a etats : Idle→Blinds→Deal→PreFlop→Flop→Turn→River→Showdown→Settle. Point d'entree unique : `advance(action?)` retourne le nouveau GameState |

Tests unitaires (Vitest) pour chaque module dans `src/engine/__tests__/`.

---

## Phase 3 - Store Zustand + IA basique

**`src/store/game-store.ts`** - Bridge entre engine et UI :
- `state: GameState`, `isAnimating: boolean`
- Actions : `startGame(config)`, `submitAction(action)`, `advanceAI()`, `nextHand()`
- Selectors : `humanPlayer()`, `isHumanTurn()`, `availableActions()`

**`src/ai/`** - 3 niveaux de difficulte :
- `strategies/base.ts` : interface `AIStrategy.decide(holeCards, community, state, actions) → PlayerAction`
- `strategies/easy.ts` : 70% call, 20% fold, 10% min-raise (pas d'evaluation)
- `strategies/medium.ts` : chart de mains de depart + pot odds post-flop
- `strategies/hard.ts` : position awareness + opponent modeling + bluff occasionnel
- `ai-player.ts` : facade avec delai simule (500-2000ms)

Commencer par easy.ts, medium/hard en Phase 6.

---

## Phase 4 - Rendu Pixi.js (`src/pixi/`)

Tous les composants avec `'use client'`.

**`setup.ts`** : `extend()` pour enregistrer les objets Pixi + GSAP PixiPlugin registration

**`hooks/useAssets.ts`** : charge spritesheet cartes, jetons, table via `Assets.load()`

**Composants** :
| Composant | Role |
|---|---|
| `PokerCanvas.tsx` | `<Application>` wrapper 1280x720, compose tout |
| `Table.tsx` | Sprite fond de table (feutre vert) |
| `Card.tsx` | Sprite carte, ref pour GSAP, prop `faceUp` pour texture |
| `CardHand.tsx` | Arrange les Card pour un joueur |
| `CommunityCards.tsx` | 5 cartes centrales |
| `ChipStack.tsx` | Pile de jetons visuelle |
| `PotDisplay.tsx` | Jetons au centre |
| `PlayerSeat.tsx` | Container : avatar + nom + jetons + cartes |
| `DealerButton.tsx` | Bouton D |

**Assets** : spritesheet cartes (52 + dos) depuis itch.io (CC0), empaquete avec free-tex-packer-cli → `public/assets/cards/cards.png` + `cards.json`

---

## Phase 5 - UI React overlay (`src/ui/`)

Composants HTML/CSS (Tailwind) positionnes en absolute par-dessus le canvas Pixi :

- **`ActionBar.tsx`** : Fold/Check/Call/Raise + slider (min raise → all-in) + presets (1/2 pot, pot, all-in). Visible uniquement quand `isHumanTurn() && !isAnimating`
- **`GameHUD.tsx`** : pot total, niveau blinds, numero de main
- **`MainMenu.tsx`** : config (nb adversaires 3-5, difficulte, jetons depart, structure blinds) + bouton Start
- **`SettingsModal.tsx`** : parametres en cours de jeu
- **`WinnerBanner.tsx`** : resultat fin de main

Pages :
- `src/app/page.tsx` → menu principal (MainMenu)
- `src/app/game/page.tsx` → layout jeu (PokerCanvas + overlays)

---

## Phase 6 - Animations GSAP (`src/animations/`)

| Fichier | Animation |
|---|---|
| `tween-manager.ts` | Coordinateur central, queue sequentielle/parallele, wraps `gsap.to` en Promise |
| `deal.ts` | Arc du deck vers chaque siege |
| `flip.ts` | scaleX 1→0 (swap texture) →1, duree 0.3s |
| `chips.ts` | Glissement jetons joueur→pot et pot→gagnant |
| `community.ts` | Reveal flop/turn/river |
| `showdown.ts` | Highlight main gagnante |

Le store met `isAnimating = true` avant les animations, `false` apres. L'ActionBar se desactive pendant.

---

## Phase 7 - Polish & IA avancee

- Implementer `medium.ts` et `hard.ts`
- `src/ai/evaluator.ts` : estimation force de main, calcul d'outs
- Son (optionnel, Howler.js)
- `HandHistory.tsx` : log scrollable
- Responsive : scale canvas au viewport
- Edge cases : tout le monde fold, split pots, side pots multiples, elimination joueur

---

## Decisions architecturales cles

1. **Engine pure TS sans dependances UI** → testable, reutilisable
2. **Animations decouplee de l'etat** → engine calcule immediatement, animation joue la transition, UI attend la fin
3. **IA async** avec delai simule → feeling naturel
4. **UI React overlay sur canvas Pixi** → boutons HTML/CSS accessibles, Pixi uniquement pour le visuel du jeu
5. **pokersolver** pour l'evaluation des mains (trop complexe a reimplementer correctement)

---

## Verification

1. **Tests unitaires** : `npx vitest` sur tout `src/engine/__tests__/`
2. **Test integration** : simuler 1000 mains avec IA random, verifier zero crash et conservation des jetons
3. **Test manuel** : jouer chaque scenario (fold pre-flop, all-in, split pot, heads-up, elimination)
4. **Dev** : `npm run dev` → navigateur sur `http://localhost:3000`
