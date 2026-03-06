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
import type { GameState } from '@/lib/gameEngine';
import { getApiBase, getWsBase } from '@/lib/apiBase';
import {
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
import { supabase } from '@/lib/supabase';

export type GameMode = 'pvp' | 'vs_bots' | 'online';

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
  joinOnlineGame: (params: { desiredPlayers: number; userId: string; displayName: string }) => Promise<void>;
  startRoomGame: (params: { gameId: string; state: GameState; playerNames: string[]; userId: string; humanPlayerIds?: string[] }) => void;
  mySeatIndex: number;
  isOnlineLoading: boolean;
  onlineError: string | null;
  // Player-left notifications for online games
  playerLeftNotif: string | null;
  leftSeatIndices: Set<number>;
  sendPlayerLeft: () => void;
  clearPlayerLeftNotif: () => void;
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
  const [isOnlineLoading, setIsOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const onlineSocketRef = useRef<WebSocket | null>(null);
  // seat index for the current user in online/room games
  const [mySeatIndex, setMySeatIndex] = useState(0);
  // stored so we can reconnect if the WS drops
  const onlineGameUrlRef = useRef<string | null>(null);
  // Which seats (by index) have quit mid-game, and the latest notification message
  const [leftSeatIndices, setLeftSeatIndices] = useState<Set<number>>(new Set());
  const [playerLeftNotif, setPlayerLeftNotif] = useState<string | null>(null);

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

  const joinOnlineGame = useCallback(
    async ({ desiredPlayers, userId, displayName }: { desiredPlayers: number; userId: string; displayName: string }) => {
      setIsOnlineLoading(true);
      setOnlineError(null);
      clearBotTimer();

      try {
        const apiBase = getApiBase();

        const ticketRes = await fetch(`${apiBase}/api/queue/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ desiredPlayers, userId, displayName }),
        });
        if (!ticketRes.ok) {
          const body = await ticketRes.json().catch(() => ({}));
          throw new Error(body.message || 'Failed to join queue');
        }
        const { ticketId } = await ticketRes.json();

        let gameId: string | null = null;
        const start = Date.now();
        while (!gameId && Date.now() - start < 65000) {
          // eslint-disable-next-line no-await-in-loop
          const statusRes = await fetch(`${apiBase}/api/queue/ticket/${ticketId}`);
          const statusBody = await statusRes.json();
          if (statusBody.status === 'matched' && statusBody.gameId) {
            gameId = statusBody.gameId;
            break;
          }
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        if (!gameId) {
          throw new Error('Matchmaking timed out. Please try again.');
        }

        const gameRes = await fetch(`${apiBase}/api/games/${gameId}`);
        if (!gameRes.ok) {
          throw new Error('Failed to load game after matchmaking');
        }
        const { state, playerNames: serverNames } = await gameRes.json();

        setPlayerNames(serverNames);
        setSelectedCardIds([]);
        setBotThinking(false);
        setBotLastAction(null);
        setGameMode('online');
        setGame(state as GameState);

        const wsUrl =
          typeof window !== 'undefined' && window.location
            ? `${window.location.origin.replace(/^http/, 'ws')}/api/ws?gameId=${encodeURIComponent(
                gameId
              )}&playerId=${encodeURIComponent(userId)}`
            : `/api/ws?gameId=${encodeURIComponent(gameId)}&playerId=${encodeURIComponent(userId)}`;

        const ws = new WebSocket(wsUrl);
        onlineSocketRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(String(event.data));
            if (msg.type === 'STATE_INIT' || msg.type === 'STATE_UPDATE') {
              setGame(msg.state as GameState);
            }
          } catch {
            // ignore malformed events
          }
        };

        ws.onclose = () => {
          onlineSocketRef.current = null;
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to join online game';
        setOnlineError(message);
      } finally {
        setIsOnlineLoading(false);
      }
    },
    [clearBotTimer]
  );

  const startRoomGame = useCallback(
    ({ gameId, state, playerNames, userId, humanPlayerIds }: { gameId: string; state: GameState; playerNames: string[]; userId: string; humanPlayerIds?: string[] }) => {
      console.log('[startRoomGame] gameId:', gameId, 'userId:', userId, 'humanPlayerIds:', humanPlayerIds);
      clearBotTimer();
      setPlayerNames(playerNames);
      setSelectedCardIds([]);
      setBotThinking(false);
      setBotLastAction(null);
      setGameMode('online');
      setGame(state);
      // Determine which seat belongs to this user
      if (humanPlayerIds) {
        const idx = humanPlayerIds.indexOf(userId);
        setMySeatIndex(idx >= 0 ? idx : 0);
      } else {
        setMySeatIndex(0);
      }

      const wsUrl = `${getWsBase()}/api/ws?gameId=${encodeURIComponent(gameId)}&playerId=${encodeURIComponent(userId)}`;

      onlineGameUrlRef.current = wsUrl;

      // Close any existing WS before opening a new one. Without this, calling
      // startRoomGame twice (e.g. owner receives both the HTTP response and the
      // lobby WS GAME_STARTED event) leaves an orphaned socket whose close event
      // later deletes the newer socket from the server's room.sockets map.
      if (onlineSocketRef.current) {
        const oldWs = onlineSocketRef.current;
        oldWs.onclose = null; // suppress the cleanup handler on the old socket
        oldWs.close();
        onlineSocketRef.current = null;
      }

      console.log('[startRoomGame] connecting WS:', wsUrl);
      const ws = new WebSocket(wsUrl);
      onlineSocketRef.current = ws;
      ws.onopen = () => {
        console.log('[WS CLIENT] connected to game WS for gameId:', gameId);
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data));
          console.log('[WS CLIENT] received:', msg.type);
          if (msg.type === 'STATE_INIT' || msg.type === 'STATE_UPDATE') {
            setGame(msg.state as GameState);
            if (Array.isArray(msg.leftSeatIndices) && msg.leftSeatIndices.length > 0) {
              setLeftSeatIndices(new Set<number>(msg.leftSeatIndices as number[]));
            }
          }
          if (msg.type === 'PLAYER_LEFT') {
            setLeftSeatIndices(prev => {
              const next = new Set(prev);
              if (typeof msg.seatIndex === 'number') next.add(msg.seatIndex);
              return next;
            });
            setPlayerLeftNotif(`${msg.playerName} left the game`);
          }
        } catch {
          // ignore
        }
      };
      ws.onerror = (err) => {
        console.error('[WS CLIENT] error:', err);
      };
      ws.onclose = (ev) => {
        console.log('[WS CLIENT] closed code:', ev.code, 'reason:', ev.reason);
        onlineSocketRef.current = null;
      };
    },
    [clearBotTimer]
  );

  // helper: send an online action, queuing if the socket is still connecting
  const sendOnlineAction = useCallback((payload: object) => {
    const socket = onlineSocketRef.current;
    const msg = JSON.stringify(payload);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(msg);
      return;
    }
    // If the socket is still connecting, wait for it to open
    if (socket && socket.readyState === WebSocket.CONNECTING) {
      socket.addEventListener('open', () => { socket.send(msg); }, { once: true });
      return;
    }
    // Socket is closed — try to reconnect using the stored URL
    const url = onlineGameUrlRef.current;
    if (!url) return;
    const newWs = new WebSocket(url);
    onlineSocketRef.current = newWs;
    newWs.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data));
        if (parsed.type === 'STATE_INIT' || parsed.type === 'STATE_UPDATE') setGame(parsed.state as GameState);
      } catch { /* ignore */ }
    };
    newWs.onclose = () => { onlineSocketRef.current = null; };
    newWs.addEventListener('open', () => { newWs.send(msg); }, { once: true });
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
    if (!game) { console.warn('[THROW] aborted: no game'); return; }
    console.log('[THROW] mode:', gameMode, 'phase:', game.phase, 'currentIdx:', game.currentPlayerIndex, 'cardIds:', cardIds);
    if (gameMode === 'online') {
      sendOnlineAction({ type: 'THROW', cardIds });
      setSelectedCardIds([]);
      return;
    }
    const before = game.players[game.currentPlayerIndex]?.hand?.length ?? 0;
    const next = throwCards(game, cardIds);
    const after = next.players[next.currentPlayerIndex >= 0 ? game.currentPlayerIndex : 0]?.hand?.length ?? 0;
    console.log('[THROW] local result — hand before:', before, 'after:', after, 'phase after:', next.phase);
    setGame(next);
    setSelectedCardIds([]);
  }, [game, gameMode, sendOnlineAction]);

  const doPickFromDeck = useCallback(() => {
    if (!game) return;
    if (gameMode === 'online') {
      sendOnlineAction({ type: 'PICK_DECK' });
      setSelectedCardIds([]);
      return;
    }
    setGame(pickFromDeck(game));
    setSelectedCardIds([]);
  }, [game, gameMode, sendOnlineAction]);

  const doPickFromAvailable = useCallback((cardId: string) => {
    if (!game) return;
    if (gameMode === 'online') {
      sendOnlineAction({ type: 'PICK_AVAILABLE', cardId });
      setSelectedCardIds([]);
      return;
    }
    setGame(pickFromAvailable(game, cardId));
    setSelectedCardIds([]);
  }, [game, gameMode, sendOnlineAction]);

  const doShow = useCallback(() => {
    if (!game) return;
    if (gameMode === 'online') {
      sendOnlineAction({ type: 'CALL_SHOW' });
      setSelectedCardIds([]);
      return;
    }
    setGame(callShow(game));
    setSelectedCardIds([]);
  }, [game, gameMode, sendOnlineAction]);

  const doNextRound = useCallback(() => {
    if (!game) return;
    clearBotTimer();
    setBotThinking(false);
    setBotLastAction(null);
    if (gameMode === 'online') {
      sendOnlineAction({ type: 'NEXT_ROUND' });
      setSelectedCardIds([]);
      return;
    }
    setGame(startNextRound(game));
    setSelectedCardIds([]);
  }, [game, gameMode, clearBotTimer, sendOnlineAction]);

  const resetGame = useCallback(() => {
    clearBotTimer();
    setGame(null);
    setPlayerNames([]);
    setSelectedCardIds([]);
    setBotThinking(false);
    setBotLastAction(null);
    setGameMode('pvp');
    setMySeatIndex(0);
    setLeftSeatIndices(new Set());
    setPlayerLeftNotif(null);
    onlineGameUrlRef.current = null;
    if (onlineSocketRef.current) {
      onlineSocketRef.current.close();
      onlineSocketRef.current = null;
    }
  }, []);

  const sendPlayerLeft = useCallback(() => {
    const socket = onlineSocketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'PLAYER_LEFT' }));
    }
  }, []);

  const clearPlayerLeftNotif = useCallback(() => {
    setPlayerLeftNotif(null);
  }, []);

  const humanPlayerIndex = useMemo(() => {
    if (!game) return 0;
    if (gameMode === 'vs_bots') return game.players.findIndex(p => !p.isBot);
    if (gameMode === 'online') return mySeatIndex;
    return 0;
  }, [game, gameMode, mySeatIndex]);

  const isHumanTurn = useMemo(() => {
    if (!game) return false;
    if (gameMode === 'pvp') return true;
    if (gameMode === 'online') return game.currentPlayerIndex === mySeatIndex;
    return game.currentPlayerIndex === humanPlayerIndex;
  }, [game, gameMode, humanPlayerIndex, mySeatIndex]);

  const currentPlayerHandScore = useMemo(() => {
    if (!game) return 0;
    const playerIdx = gameMode === 'online' ? mySeatIndex : (gameMode === 'vs_bots' ? humanPlayerIndex : game.currentPlayerIndex);
    const player = game.players[playerIdx];
    return player ? getHandScore(player.hand) : 0;
  }, [game, gameMode, humanPlayerIndex, mySeatIndex]);

  const throwSelectionValid = useMemo(() => {
    if (!game || selectedCardIds.length === 0) return false;
    if (gameMode === 'online') {
      const player = game.players[mySeatIndex];
      if (!player) return false;
      const selected = player.hand.filter(c => selectedCardIds.includes(c.id));
      return isValidThrow(selected);
    }
    const player = game.players[game.currentPlayerIndex];
    const selected = player.hand.filter(c => selectedCardIds.includes(c.id));
    return isValidThrow(selected);
  }, [game, selectedCardIds, gameMode, mySeatIndex]);

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
    joinOnlineGame,
    startRoomGame,
    mySeatIndex,
    isOnlineLoading,
    onlineError,
    playerLeftNotif,
    leftSeatIndices,
    sendPlayerLeft,
    clearPlayerLeftNotif,
  }), [
    game, playerNames, gameMode, selectedCardIds,
    botThinking, botLastAction,
    startGame, startGameVsBots,
    selectCard, clearSelection,
    doThrowCards, doPickFromDeck, doPickFromAvailable,
    doShow, doNextRound, resetGame,
    currentPlayerHandScore, throwSelectionValid, showAllowed,
    humanPlayerIndex, isHumanTurn, mySeatIndex,
    joinOnlineGame, startRoomGame, isOnlineLoading, onlineError,
    playerLeftNotif, leftSeatIndices, sendPlayerLeft, clearPlayerLeftNotif,
  ]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
