export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  score: number;
  eliminated: boolean;
  isBot: boolean;
}

export interface GameState {
  players: Player[];
  deck: Card[];
  deadPile: Card[];
  currentAvailable: Card[];
  lastThrownCards: Card[];
  currentPlayerIndex: number;
  phase: 'throw' | 'pick' | 'show_reveal' | 'game_over';
  roundNumber: number;
  turnsCompleted: number;
  showCalledByIndex: number | null;
  roundScores: { playerId: string; handScore: number; added: number }[];
  winner: Player | null;
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_VALUES: Record<Rank, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13,
};
const RANK_ORDER: Record<Rank, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13,
};

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}-${suit}`, suit, rank, value: RANK_VALUES[rank] });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function initGame(playerNames: string[], botIndices: number[] = [], forcedStarterIndex?: number): GameState {
  const deck = shuffleDeck(createDeck());
  const players: Player[] = playerNames.map((name, idx) => ({
    id: `player-${idx}`,
    name,
    hand: [],
    score: 0,
    eliminated: false,
    isBot: botIndices.includes(idx),
  }));

  let deckIndex = 0;
  const starterIndex =
    forcedStarterIndex !== undefined && forcedStarterIndex >= 0 && forcedStarterIndex < players.length
      ? forcedStarterIndex
      : Math.floor(Math.random() * players.length);

  for (let i = 0; i < players.length; i++) {
    const handSize = i === starterIndex ? 8 : 7;
    for (let j = 0; j < handSize; j++) {
      players[i].hand.push(deck[deckIndex++]);
    }
  }

  const remainingDeck = deck.slice(deckIndex);
  const firstDiscard = remainingDeck.shift()!;

  return {
    players,
    deck: remainingDeck,
    deadPile: [],
    currentAvailable: [firstDiscard],
    lastThrownCards: [],
    currentPlayerIndex: starterIndex,
    phase: 'throw',
    roundNumber: 1,
    turnsCompleted: 0,
    showCalledByIndex: null,
    roundScores: [],
    winner: null,
  };
}

export function getHandScore(hand: Card[]): number {
  return hand.reduce((sum, c) => sum + c.value, 0);
}

export function isValidSequence(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  const sorted = [...cards].sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
  for (let i = 1; i < sorted.length; i++) {
    if (RANK_ORDER[sorted[i].rank] !== RANK_ORDER[sorted[i - 1].rank] + 1) return false;
  }
  return true;
}

export function isValidPair(cards: Card[]): boolean {
  if (cards.length < 2) return false;
  const rank = cards[0].rank;
  return cards.every(c => c.rank === rank);
}

export function isValidThrow(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  if (cards.length === 1) return true;
  return isValidSequence(cards) || isValidPair(cards);
}

function nextActiveIndex(players: Player[], from: number): number {
  let idx = (from + 1) % players.length;
  while (players[idx].eliminated) {
    idx = (idx + 1) % players.length;
  }
  return idx;
}

export function throwCards(state: GameState, cardIds: string[]): GameState {
  if (state.phase !== 'throw') return state;
  const player = { ...state.players[state.currentPlayerIndex] };
  const thrown = player.hand.filter(c => cardIds.includes(c.id));
  if (!isValidThrow(thrown)) return state;

  player.hand = player.hand.filter(c => !cardIds.includes(c.id));
  const players = [...state.players];
  players[state.currentPlayerIndex] = player;

  return {
    ...state,
    players,
    lastThrownCards: thrown,
    phase: 'pick',
  };
}

function drawFromDeckInternal(state: GameState): { card: Card; newDeck: Card[]; newDead: Card[] } {
  if (state.deck.length > 0) {
    const [card, ...rest] = state.deck;
    return { card, newDeck: rest, newDead: state.deadPile };
  }
  const recycled = shuffleDeck([...state.deadPile]);
  const [card, ...rest] = recycled;
  return { card, newDeck: rest, newDead: [] };
}

export function pickFromDeck(state: GameState): GameState {
  if (state.phase !== 'pick') return state;
  const { card, newDeck, newDead } = drawFromDeckInternal(state);
  const player = { ...state.players[state.currentPlayerIndex] };
  player.hand = [...player.hand, card];
  const players = [...state.players];
  players[state.currentPlayerIndex] = player;

  const nextIdx = nextActiveIndex(players, state.currentPlayerIndex);
  const activePlayers = players.filter(p => !p.eliminated);

  return {
    ...state,
    players,
    deck: newDeck,
    deadPile: [...newDead, ...state.currentAvailable],
    currentAvailable: state.lastThrownCards,
    lastThrownCards: [],
    currentPlayerIndex: nextIdx,
    phase: activePlayers.length === 1 ? 'game_over' : 'throw',
    turnsCompleted: state.turnsCompleted + 1,
    winner: activePlayers.length === 1 ? activePlayers[0] : null,
  };
}

export function pickFromAvailable(state: GameState, cardId: string): GameState {
  if (state.phase !== 'pick') return state;
  const pickedCard = state.currentAvailable.find(c => c.id === cardId);
  if (!pickedCard) return state;

  const remaining = state.currentAvailable.filter(c => c.id !== cardId);
  const player = { ...state.players[state.currentPlayerIndex] };
  player.hand = [...player.hand, pickedCard];
  const players = [...state.players];
  players[state.currentPlayerIndex] = player;

  const nextIdx = nextActiveIndex(players, state.currentPlayerIndex);
  const activePlayers = players.filter(p => !p.eliminated);

  return {
    ...state,
    players,
    deadPile: [...state.deadPile, ...remaining],
    currentAvailable: state.lastThrownCards,
    lastThrownCards: [],
    currentPlayerIndex: nextIdx,
    phase: activePlayers.length === 1 ? 'game_over' : 'throw',
    turnsCompleted: state.turnsCompleted + 1,
    winner: activePlayers.length === 1 ? activePlayers[0] : null,
  };
}

export function canCallShow(state: GameState): boolean {
  if (state.phase !== 'throw') return false;
  const activePlayers = state.players.filter(p => !p.eliminated);
  return state.turnsCompleted >= activePlayers.length;
}

export function callShow(state: GameState): GameState {
  if (!canCallShow(state)) return state;

  const showingIndex = state.currentPlayerIndex;
  const showingPlayer = state.players[showingIndex];
  const showingScore = getHandScore(showingPlayer.hand);

  let hasBetterScore = false;
  for (let i = 0; i < state.players.length; i++) {
    if (state.players[i].eliminated || i === showingIndex) continue;
    if (getHandScore(state.players[i].hand) < showingScore) {
      hasBetterScore = true;
      break;
    }
  }

  const roundScores: { playerId: string; handScore: number; added: number }[] = [];

  const updatedPlayers = state.players.map((p, i) => {
    if (p.eliminated) return p;
    const handScore = getHandScore(p.hand);
    let added = 0;

    if (i === showingIndex) {
      added = hasBetterScore ? 15 : 0;
    } else {
      added = hasBetterScore ? 0 : Math.max(0, handScore - showingScore);
    }

    roundScores.push({ playerId: p.id, handScore, added });

    const newTotal = p.score + added;
    return {
      ...p,
      score: newTotal,
      eliminated: newTotal >= 100,
    };
  });

  const activePlayers = updatedPlayers.filter(p => !p.eliminated);

  if (activePlayers.length <= 1) {
    return {
      ...state,
      players: updatedPlayers,
      phase: 'game_over',
      showCalledByIndex: showingIndex,
      roundScores,
      winner: activePlayers[0] ?? updatedPlayers.reduce((min, p) => p.score < min.score ? p : min, updatedPlayers[0]),
    };
  }

  return {
    ...state,
    players: updatedPlayers,
    phase: 'show_reveal',
    showCalledByIndex: showingIndex,
    roundScores,
  };
}

export function startNextRound(state: GameState): GameState {
  const activePlayers = state.players.filter(p => !p.eliminated);
  if (activePlayers.length <= 1) {
    return { ...state, phase: 'game_over', winner: activePlayers[0] ?? state.players[0] };
  }

  const deck = shuffleDeck(createDeck());
  let deckIndex = 0;
  const starterIdx = Math.floor(Math.random() * activePlayers.length);
  const starterPlayer = activePlayers[starterIdx];

  const updatedPlayers = state.players.map(p => {
    if (p.eliminated) return { ...p, hand: [] };
    const handSize = p.id === starterPlayer.id ? 8 : 7;
    const hand: Card[] = [];
    for (let j = 0; j < handSize; j++) hand.push(deck[deckIndex++]);
    return { ...p, hand };
  });

  const remainingDeck = deck.slice(deckIndex);
  const firstDiscard = remainingDeck.shift()!;
  const newCurrentIndex = state.players.findIndex(p => p.id === starterPlayer.id);

  return {
    ...state,
    players: updatedPlayers,
    deck: remainingDeck,
    deadPile: [],
    currentAvailable: [firstDiscard],
    lastThrownCards: [],
    currentPlayerIndex: newCurrentIndex,
    phase: 'throw',
    roundNumber: state.roundNumber + 1,
    turnsCompleted: 0,
    showCalledByIndex: null,
    roundScores: [],
    winner: null,
  };
}

export function getSuitSymbol(suit: Suit): string {
  switch (suit) {
    case 'hearts': return '♥';
    case 'diamonds': return '♦';
    case 'clubs': return '♣';
    case 'spades': return '♠';
  }
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}
