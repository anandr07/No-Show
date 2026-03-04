import {
  GameState,
  Card,
  Rank,
  throwCards,
  pickFromDeck,
  pickFromAvailable,
  callShow,
  canCallShow,
  getHandScore,
  isValidSequence,
  isValidPair,
} from './gameEngine';

const RANK_ORDER: Record<Rank, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13,
};

function findBestThrow(hand: Card[]): Card[] {
  if (hand.length === 0) return [];

  const byRank: Record<string, Card[]> = {};
  for (const c of hand) {
    if (!byRank[c.rank]) byRank[c.rank] = [];
    byRank[c.rank].push(c);
  }

  const candidates: Card[][] = [];

  for (const group of Object.values(byRank)) {
    if (group.length >= 2) candidates.push(group);
  }

  const sorted = [...hand].sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
  for (let start = 0; start < sorted.length; start++) {
    let run: Card[] = [sorted[start]];
    for (let end = start + 1; end < sorted.length; end++) {
      const prev = run[run.length - 1];
      const curr = sorted[end];
      if (RANK_ORDER[curr.rank] === RANK_ORDER[prev.rank] + 1) {
        run.push(curr);
      } else if (RANK_ORDER[curr.rank] === RANK_ORDER[prev.rank]) {
        continue;
      } else {
        break;
      }
    }
    if (run.length >= 3) candidates.push(run);
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      const scoreA = a.reduce((s, c) => s + c.value, 0);
      const scoreB = b.reduce((s, c) => s + c.value, 0);
      return scoreB - scoreA;
    });
    return candidates[0];
  }

  const highCard = [...hand].sort((a, b) => b.value - a.value)[0];
  return [highCard];
}

function pickBestFromAvailable(available: Card[], hand: Card[]): Card | null {
  if (available.length === 0) return null;

  let bestCard: Card | null = null;
  let bestImprovement = -Infinity;

  const currentScore = getHandScore(hand);

  for (const candidate of available) {
    const scoreWithCard = getHandScore([...hand, candidate]);
    const improvement = currentScore - scoreWithCard;
    if (improvement > bestImprovement) {
      bestImprovement = improvement;
      bestCard = candidate;
    }
  }

  return bestCard;
}

export interface BotAction {
  type: 'throw' | 'pick_available' | 'pick_deck' | 'show';
  cardIds?: string[];
  description: string;
}

export function executeBotTurn(state: GameState): {
  finalState: GameState;
  actions: BotAction[];
} {
  const actions: BotAction[] = [];
  let currentState = state;
  const player = currentState.players[currentState.currentPlayerIndex];

  if (currentState.phase === 'throw') {
    if (canCallShow(currentState)) {
      const score = getHandScore(player.hand);
      const shouldShow = score <= 6 && Math.random() > 0.25;
      const shouldShowMedium = score <= 3;
      if (shouldShowMedium || shouldShow) {
        const nextState = callShow(currentState);
        actions.push({ type: 'show', description: `called Show with score ${score}` });
        return { finalState: nextState, actions };
      }
    }

    const toThrow = findBestThrow(player.hand);
    const throwDesc = toThrow.length === 1
      ? `discarded ${toThrow[0].rank}`
      : `threw ${toThrow.map(c => c.rank).join(',')} (${isValidSequence(toThrow) ? 'sequence' : 'pair'})`;

    actions.push({ type: 'throw', cardIds: toThrow.map(c => c.id), description: throwDesc });
    currentState = throwCards(currentState, toThrow.map(c => c.id));
  }

  if (currentState.phase === 'pick') {
    const currentPlayer = currentState.players[currentState.currentPlayerIndex];
    const bestFromAvailable = pickBestFromAvailable(currentState.currentAvailable, currentPlayer.hand);

    if (bestFromAvailable) {
      const gainedScore = getHandScore(currentPlayer.hand) - getHandScore([...currentPlayer.hand, bestFromAvailable]);
      const shouldPickAvailable = gainedScore >= 0;

      if (shouldPickAvailable) {
        actions.push({
          type: 'pick_available',
          cardIds: [bestFromAvailable.id],
          description: `picked ${bestFromAvailable.rank} from thrown cards`,
        });
        currentState = pickFromAvailable(currentState, bestFromAvailable.id);
        return { finalState: currentState, actions };
      }
    }

    actions.push({ type: 'pick_deck', description: 'drew from deck' });
    currentState = pickFromDeck(currentState);
  }

  return { finalState: currentState, actions };
}
