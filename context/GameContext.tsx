import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  GameState,
  initGame,
  throwCards,
  pickFromDeck,
  pickFromAvailable,
  callShow,
  canCallShow,
  startNextRound,
  isValidThrow,
  getHandScore,
} from '@/lib/gameEngine';
import { executeBotTurn, BotAction } from '@/lib/botAI';

export type GameMode = 'pvp' | 'vs_bots';

interface GameContextValue {
  game: GameState | null;
  playerNames: string[];
  gameMode: GameMode;
  selectedCardIds: string[];
  botThinking: boolean;
  botLastAction: string | null;
  startGame: (names: string[]) => void;
  startGameVsBots: (humanName: string, botCount: number) => void;
  selectCard: (cardId: string) => void;
  clearSelection: () => void;
  doThrowCards: (cardIds: string[]) => void;
  doPickFromDeck: () => void;
  doPickFromAvailable: (cardId: string) => void;
  doShow: () => void;
  doNextRound: () => void;
  resetGame: () => void;
  currentPlayerHandScore: number;
  throwSelectionValid: boolean;
  showAllowed: boolean;
  humanPlayerIndex: number;
  isHumanTurn: boolean;
}

const GameContext = createContext<GameContextValue | null>(null);

const BOT_NAMES = ['Shadow', 'Viper', 'Nova', 'Rook', 'Blaze', 'Cipher'];

export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<GameState | null>(null);
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const [gameMode, setGameMode] = useState<GameMode>('pvp');
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [botThinking, setBotThinking] = useState(false);
  const [botLastAction, setBotLastAction] = useState<string | null>(null);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameRef = useRef<GameState | null>(null);

  gameRef.current = game;

  const clearBotTimer = () => {
    if (botTimerRef.current) {
      clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }
  };

  const startGame = useCallback((names: string[]) => {
    clearBotTimer();
    setPlayerNames(names);
    setSelectedCardIds([]);
    setBotThinking(false);
    setBotLastAction(null);
    setGameMode('pvp');
    setGame(initGame(names, []));
  }, []);

  const startGameVsBots = useCallback((humanName: string, botCount: number) => {
    clearBotTimer();
    const clampedBotCount = Math.min(5, Math.max(2, botCount));
    const shuffledBotNames = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, clampedBotCount);
    const allNames = [humanName, ...shuffledBotNames];
    const botIndices = shuffledBotNames.map((_, i) => i + 1);
    setPlayerNames(allNames);
    setSelectedCardIds([]);
    setBotThinking(false);
    setBotLastAction(null);
    setGameMode('vs_bots');
    setGame(initGame(allNames, botIndices));
  }, []);

  useEffect(() => {
    if (!game || gameMode !== 'vs_bots') return;
    if (game.phase !== 'throw' && game.phase !== 'pick') return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (!currentPlayer.isBot) return;

    clearBotTimer();
    setBotThinking(true);
    setBotLastAction(null);

    const thinkDelay = 900 + Math.random() * 700;

    botTimerRef.current = setTimeout(() => {
      const currentGame = gameRef.current;
      if (!currentGame) return;
      if (currentGame.phase !== 'throw' && currentGame.phase !== 'pick') return;
      const cp = currentGame.players[currentGame.currentPlayerIndex];
      if (!cp.isBot) return;

      try {
        const { finalState, actions } = executeBotTurn(currentGame);
        const actionDesc = actions.map(a => a.description).join(', then ');
        setBotLastAction(`${cp.name} ${actionDesc}`);
        setBotThinking(false);
        setGame(finalState);
      } catch (err) {
        console.warn('Bot error:', err);
        setBotThinking(false);
      }
    }, thinkDelay);

    return () => clearBotTimer();
  }, [game?.currentPlayerIndex, game?.phase, game?.roundNumber, gameMode]);

  useEffect(() => {
    if (!botLastAction) return;
    const timer = setTimeout(() => setBotLastAction(null), 3000);
    return () => clearTimeout(timer);
  }, [botLastAction]);

  const selectCard = useCallback((cardId: string) => {
    setSelectedCardIds(prev =>
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  }, []);

  const clearSelection = useCallback(() => setSelectedCardIds([]), []);

  const doThrowCards = useCallback((cardIds: string[]) => {
    if (!game) return;
    setGame(throwCards(game, cardIds));
    setSelectedCardIds([]);
  }, [game]);

  const doPickFromDeck = useCallback(() => {
    if (!game) return;
    setGame(pickFromDeck(game));
    setSelectedCardIds([]);
  }, [game]);

  const doPickFromAvailable = useCallback((cardId: string) => {
    if (!game) return;
    setGame(pickFromAvailable(game, cardId));
    setSelectedCardIds([]);
  }, [game]);

  const doShow = useCallback(() => {
    if (!game) return;
    setGame(callShow(game));
    setSelectedCardIds([]);
  }, [game]);

  const doNextRound = useCallback(() => {
    if (!game) return;
    clearBotTimer();
    setBotThinking(false);
    setBotLastAction(null);
    setGame(startNextRound(game));
    setSelectedCardIds([]);
  }, [game]);

  const resetGame = useCallback(() => {
    clearBotTimer();
    setGame(null);
    setPlayerNames([]);
    setSelectedCardIds([]);
    setBotThinking(false);
    setBotLastAction(null);
    setGameMode('pvp');
  }, []);

  const humanPlayerIndex = useMemo(() => {
    if (!game || gameMode !== 'vs_bots') return 0;
    return game.players.findIndex(p => !p.isBot);
  }, [game, gameMode]);

  const isHumanTurn = useMemo(() => {
    if (!game) return false;
    if (gameMode === 'pvp') return true;
    return game.currentPlayerIndex === humanPlayerIndex;
  }, [game, gameMode, humanPlayerIndex]);

  const currentPlayerHandScore = useMemo(() => {
    if (!game) return 0;
    const playerIdx = gameMode === 'vs_bots' ? humanPlayerIndex : game.currentPlayerIndex;
    const player = game.players[playerIdx];
    return player ? getHandScore(player.hand) : 0;
  }, [game, gameMode, humanPlayerIndex]);

  const throwSelectionValid = useMemo(() => {
    if (!game || selectedCardIds.length === 0) return false;
    const player = game.players[game.currentPlayerIndex];
    const selected = player.hand.filter(c => selectedCardIds.includes(c.id));
    return isValidThrow(selected);
  }, [game, selectedCardIds]);

  const showAllowed = useMemo(() => {
    if (!game) return false;
    return canCallShow(game);
  }, [game]);

  const value = useMemo<GameContextValue>(() => ({
    game,
    playerNames,
    gameMode,
    selectedCardIds,
    botThinking,
    botLastAction,
    startGame,
    startGameVsBots,
    selectCard,
    clearSelection,
    doThrowCards,
    doPickFromDeck,
    doPickFromAvailable,
    doShow,
    doNextRound,
    resetGame,
    currentPlayerHandScore,
    throwSelectionValid,
    showAllowed,
    humanPlayerIndex,
    isHumanTurn,
  }), [
    game, playerNames, gameMode, selectedCardIds,
    botThinking, botLastAction,
    startGame, startGameVsBots,
    selectCard, clearSelection,
    doThrowCards, doPickFromDeck, doPickFromAvailable,
    doShow, doNextRound, resetGame,
    currentPlayerHandScore, throwSelectionValid, showAllowed,
    humanPlayerIndex, isHumanTurn,
  ]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
