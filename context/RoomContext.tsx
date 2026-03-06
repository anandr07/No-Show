import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import { useGame } from '@/context/GameContext';
import type { GameState } from '@/lib/gameEngine';
import { getApiBase, getWsBase } from '@/lib/apiBase';

const apiBase = getApiBase();

export type RoomPlayer = {
  user_id: string;
  display_name: string;
  is_owner: boolean;
  is_ready: boolean;
  seat_index: number | null;
};

type RoomLobby = {
  id: string;
  room_code: string;
  owner_id: string;
  status: string;
  game_id: string | null;
  players: RoomPlayer[];
};

interface RoomContextValue {
  roomId: string | null;
  roomCode: string | null;
  players: RoomPlayer[];
  isOwner: boolean;
  error: string | null;
  loading: boolean;
  createRoom: (params: { userId: string; displayName: string }) => Promise<void>;
  joinRoom: (params: { roomCode: string; userId: string; displayName: string }) => Promise<void>;
  leaveRoom: (params: { roomId: string; userId: string }) => Promise<void>;
  setReady: (params: { roomId: string; userId: string; isReady: boolean }) => Promise<void>;
  startMatch: (params: { roomId: string; userId: string }) => Promise<void>;
  connectLobbyWs: (params: {
    roomId: string;
    roomCode: string;
    userId: string;
    onGameStarted?: () => void;
  }) => void;
  clearRoom: () => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const gameContext = useGame();
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearRoom = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setRoomId(null);
    setRoomCode(null);
    setPlayers([]);
    setIsOwner(false);
    setError(null);
  }, []);

  const connectLobbyWs = useCallback(
    ({
      roomId: id,
      roomCode: code,
      userId,
      onGameStarted,
    }: {
      roomId: string;
      roomCode: string;
      userId: string;
      onGameStarted?: () => void;
    }) => {
      if (wsRef.current) wsRef.current.close();
      const ws = new WebSocket(
        `${getWsBase()}/api/ws-room?roomCode=${encodeURIComponent(code)}&userId=${encodeURIComponent(userId)}`
      );
      wsRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data));
          if (msg.type === 'ROOM_UPDATE' && Array.isArray(msg.players)) {
            setPlayers(msg.players);
          }
          if (msg.type === 'GAME_STARTED' && msg.gameId && msg.state && msg.playerNames) {
            if (wsRef.current) {
              wsRef.current.close();
              wsRef.current = null;
            }
            gameContext.startRoomGame({
              gameId: msg.gameId,
              state: msg.state as GameState,
              playerNames: msg.playerNames,
              userId,
              humanPlayerIds: msg.humanPlayerIds,
            });
            onGameStarted?.();
          }
        } catch {
          // ignore
        }
      };
      ws.onclose = () => {
        wsRef.current = null;
      };
    },
    [gameContext, clearRoom]
  );

  // Lightweight polling as a fallback to ensure lobby stays in sync
  useEffect(() => {
    if (!roomId) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }
    const urlBase = apiBase;
    if (!urlBase.startsWith('http')) return;

    const fetchLobby = async () => {
      try {
        const res = await fetch(`${urlBase}/api/rooms/${roomId}`);
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data) return;
        if (Array.isArray(data.players)) {
          setPlayers(data.players);
        }
      } catch {
        // ignore polling errors
      }
    };

    fetchLobby();
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(fetchLobby, 2500);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [roomId]);

  const createRoom = useCallback(
    async ({ userId, displayName }: { userId: string; displayName: string }) => {
      setError(null);
      if (!apiBase.startsWith('http')) {
        setError('Server URL not set. Add EXPO_PUBLIC_API_BASE_URL to .env and restart the app.');
        return;
      }
      setLoading(true);
      try {
        const url = `${apiBase}/api/rooms`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, displayName }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to create room');
        setRoomId(data.roomId);
        setRoomCode(data.roomCode);
        setPlayers([
          {
            user_id: userId,
            display_name: displayName,
            is_owner: true,
            is_ready: false,
            seat_index: null,
          },
        ]);
        setIsOwner(true);
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : String(e);
        setError(msg === 'Failed to fetch' || msg.includes('Network')
          ? 'Cannot reach server. Is the backend running? Same Wi‑Fi?'
          : msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const joinRoom = useCallback(
    async ({ roomCode: code, userId, displayName }: { roomCode: string; userId: string; displayName: string }) => {
      setLoading(true);
      setError(null);
      try {
        const url = `${apiBase}/api/rooms/join`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: code.toUpperCase().trim(),
            userId,
            displayName,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to join room');
        setRoomId(data.roomId);
        setRoomCode(data.roomCode);
        setPlayers(data.players ?? []);
        setIsOwner(data.owner_id === userId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          msg === 'Failed to fetch' || msg.includes('Network')
            ? 'Cannot reach server. Is the backend running? Same Wi‑Fi?'
            : msg
        );
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const leaveRoom = useCallback(async ({ roomId: id, userId }: { roomId: string; userId: string }) => {
    try {
      await fetch(`${apiBase}/api/rooms/${id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    } finally {
      clearRoom();
    }
  }, [clearRoom]);

  const setReady = useCallback(
    async ({ roomId: id, userId, isReady }: { roomId: string; userId: string; isReady: boolean }) => {
      const res = await fetch(`${apiBase}/api/rooms/${id}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isReady }),
      });
      if (!res.ok) return;
      setPlayers((prev) =>
        prev.map((p) => (p.user_id === userId ? { ...p, is_ready: isReady } : p))
      );
    },
    []
  );

  const startMatch = useCallback(
    async ({ roomId: id, userId }: { roomId: string; userId: string }) => {
      setLoading(true);
      setError(null);
      try {
        const url = `${apiBase}/api/rooms/${id}/start`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to start game');
        const { gameId, state, playerNames, humanPlayerIds } = data;
        if (gameId && state && playerNames) {
          gameContext.startRoomGame({
            gameId,
            state: state as GameState,
            playerNames,
            userId,
            humanPlayerIds,
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || 'Failed to start game');
      } finally {
        setLoading(false);
      }
    },
    [gameContext]
  );

  const value: RoomContextValue = {
    roomId,
    roomCode,
    players,
    isOwner,
    error,
    loading,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    startMatch,
    connectLobbyWs,
    clearRoom,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within RoomProvider');
  return ctx;
}
