# No Show — Card Game App

## Overview
A multiplayer pass-and-play card game for 3–6 players. Players compete to keep their hand score low by forming sequences and pairs. The first player to reach or exceed 99 points is eliminated. The last player remaining wins.

## Architecture
- **Frontend**: Expo Router (React Native), file-based routing, no tab bar
- **Backend**: Express.js on port 5000 (landing page + API)
- **State**: React Context (GameContext) with in-memory game state
- **Storage**: AsyncStorage (not yet used; game state is session-only)

## Stack
- Expo SDK 54, Expo Router v6
- React Native with Reanimated v3 animations
- Playfair Display + Inter fonts (@expo-google-fonts)
- expo-linear-gradient, expo-haptics, expo-blur
- @tanstack/react-query (client), express (server)

## Screen Structure
- `app/index.tsx` — Home screen with animated floating cards
- `app/setup.tsx` — Player name entry (3–6 players)
- `app/game.tsx` — Main game screen (deck, hand, actions)
- `app/results.tsx` — Final scores and winner display
- `app/howtoplay.tsx` — Rules reference

## Key Files
- `lib/gameEngine.ts` — Complete game logic (dealing, draw, discard, show, elimination)
- `lib/botAI.ts` — Rule-based bot AI
- `context/GameContext.tsx` — React context wrapping game state
- `components/CardView.tsx` — Card rendering component (normal/small/tiny sizes)
- `constants/colors.ts` — Dark premium navy + gold theme

## Design
- Dark navy (#0A1628) background, gold (#D4AF37) accents
- Playfair Display for headings, Inter for body
- All icons via @expo/vector-icons (no emojis)
- Safe area insets applied correctly for all platforms

## Game Rules (Fully Implemented)
- 3–6 players, 52-card standard deck
- One player gets 8 cards (starter), rest get 7. 1 card placed face-up (AVAILABLE).
- **Turn order: THROW first, then PICK**
  - THROW: Select 1 card, pair of 2+ same rank, or sequence of 3+ consecutive and throw them all
  - PICK: After throwing, pick 1 card from AVAILABLE (previous player's thrown cards) or DECK
- No "declared combos" — you throw the combo cards out of your hand entirely
- Hand size varies (throw 3, pick 1 = net −2 cards)
- **Show restriction**: Cannot call Show until all players have had at least 1 turn (first full rotation)
- **Show scoring**: Shower gets 0 if they have lowest score; others add (their score − shower's score). If any player beats the shower, shower gets +15 ONLY, all others get 0.
- Eliminated at score ≥ 100; last player remaining wins

## Architecture Notes
- **Phases**: `'throw'` (green dot) → `'pick'` (gray dot) → next player's `'throw'`
- **PassDeviceOverlay** (PvP): triggers on `phase === 'pick'` (after a throw)
- **turnsCompleted**: tracks completed turns per round; Show allowed when `>= activePlayers.length`
- **currentAvailable**: cards the next player can pick from (previous player's thrown cards, or initial face-up at round start)
- **deadPile**: cards that went through the game (picked-from leftover throws, used for deck recycling)

## Critical Bug Fixes Applied
1. **ThinkingDot animation** — uses `withDelay` + `cancelAnimation` cleanup to prevent iOS crashes
2. **Show penalty fix** — shower gets +15 only (not +handScore+15); other players get +0 when shower is penalized (not +their hand score)
3. **Elimination threshold fixed** — now >= 100 (not >= 99)
