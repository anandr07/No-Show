import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import {
  GameState,
  initGame,
  throwCards,
  pickFromDeck,
  pickFromAvailable,
  callShow,
  startNextRound,
} from "@/lib/gameEngine";
import { executeBotTurn } from "@/lib/botAI";
import { supabaseServer } from "./supabaseServer";
import { recordVsSystemHistory } from "./history";

type GameRoom = {
  id: string;
  desiredPlayers: number;
  humanPlayerIds: string[];
  playerNames: string[];
  state: GameState;
  sockets: Map<string, WebSocket>; // key: playerId
  createdAt: number;
  leftSeatIndices: Set<number>; // seats whose human player quit mid-game
};

type QueueEntry = {
  ticketId: string;
  userId: string;
  displayName: string;
  desiredPlayers: number;
  joinedAt: number;
};

const matchmakingQueues: Map<number, QueueEntry[]> = new Map();
const gameRooms: Map<string, GameRoom> = new Map();

// ----- Room lobby (friend rooms) -----
const ALPHANUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
  }
  return code;
}

type RoomLobbySockets = Map<string, WebSocket>; // userId -> socket
const roomLobbySockets: Map<string, RoomLobbySockets> = new Map(); // roomId -> sockets

async function getRoomByCode(roomCode: string): Promise<{ id: string; owner_id: string; status: string } | null> {
  const { data, error } = await supabaseServer
    .from("rooms")
    .select("id, owner_id, status")
    .eq("room_code", String(roomCode).toUpperCase())
    .single();
  if (error || !data) return null;
  return data as { id: string; owner_id: string; status: string };
}

async function getRoomWithPlayers(roomId: string) {
  const { data: room, error: roomErr } = await supabaseServer
    .from("rooms")
    .select("id, room_code, owner_id, status, game_id")
    .eq("id", roomId)
    .single();
  if (roomErr || !room) return null;
  const { data: players, error: playersErr } = await supabaseServer
    .from("room_players")
    .select("user_id, display_name, is_owner, is_ready, seat_index")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  if (playersErr) return { ...room, players: [] };
  return { ...room, players: players ?? [] };
}

function broadcastRoomUpdate(roomId: string, payload: object) {
  const sockets = roomLobbySockets.get(roomId);
  if (!sockets) return;
  const msg = JSON.stringify(payload);
  sockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

async function ensureProfileExists(userId: string, displayName: string) {
  if (!userId) return;
  const { data: existing } = await supabaseServer
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();
  if (existing) return;

  const baseName = String(displayName).trim() || "player";
  const safeBase = baseName.replace(/\s+/g, "_").toLowerCase();
  const username = `${safeBase}_${userId.slice(0, 8)}`;

  const { error } = await supabaseServer.from("profiles").insert({
    id: userId,
    username,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to auto-create profile for room join/create", error);
  }
}

function ensureQueue(size: number): QueueEntry[] {
  if (!matchmakingQueues.has(size)) {
    matchmakingQueues.set(size, []);
  }
  return matchmakingQueues.get(size)!;
}

function createRoomFromQueue(desiredPlayers: number, entries: QueueEntry[]): GameRoom {
  const names = entries.map((e) => e.displayName);
  const botCount = Math.max(0, desiredPlayers - entries.length);
  const botNames = ["Shadow", "Viper", "Nova", "Rook", "Blaze", "Cipher"].slice(
    0,
    botCount
  );
  const allNames = [...names, ...botNames];
  const botIndices = botNames.map((_, i) => entries.length + i);

  const state = initGame(allNames, botIndices);
  const id = state.players.map((p) => p.id).join("-") + "-" + Date.now().toString(36);

  const room: GameRoom = {
    id,
    desiredPlayers,
    humanPlayerIds: entries.map((e) => e.userId),
    playerNames: allNames,
    state,
    sockets: new Map(),
    createdAt: Date.now(),
    leftSeatIndices: new Set(),
  };

  gameRooms.set(id, room);

  // Basic persistence of game + players
  void supabaseServer
    .from("games")
    .insert({
      id,
      mode: "multiplayer_online",
      max_players: desiredPlayers,
      actual_players: allNames.length,
    })
    .then(({ error }) => {
      if (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to persist game row", error);
      }
    });

  return room;
}

function tryMatchQueuedPlayers(desiredPlayers: number) {
  const queue = ensureQueue(desiredPlayers);
  while (queue.length >= desiredPlayers) {
    const group = queue.splice(0, desiredPlayers);
    const room = createRoomFromQueue(desiredPlayers, group);
    // In an HTTP-only world we would notify via polling; actual WebSocket
    // notification happens when clients connect with gameId.
    // For now we rely on clients polling /api/queue/ticket/:id.
    group.forEach((entry) => {
      // nothing to do here yet
      void entry;
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/health", (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, message: "Backend is reachable" });
  });

  app.post("/api/queue/join", (req: Request, res: Response) => {
    const { userId, displayName, desiredPlayers } = req.body ?? {};
    if (!userId || !displayName || !desiredPlayers) {
      return res.status(400).json({ message: "userId, displayName and desiredPlayers required" });
    }
    if (desiredPlayers < 3 || desiredPlayers > 6) {
      return res.status(400).json({ message: "desiredPlayers must be between 3 and 6" });
    }

    const ticketId = `${userId}-${Date.now().toString(36)}`;
    const entry: QueueEntry = {
      ticketId,
      userId,
      displayName,
      desiredPlayers,
      joinedAt: Date.now(),
    };

    const queue = ensureQueue(desiredPlayers);
    queue.push(entry);

    tryMatchQueuedPlayers(desiredPlayers);

    res.status(200).json({ ticketId });
  });

  app.get("/api/queue/ticket/:ticketId", (req: Request, res: Response) => {
    const { ticketId } = req.params;
    for (const room of gameRooms.values()) {
      if (room.humanPlayerIds.some((id) => ticketId.startsWith(id))) {
        return res.status(200).json({ status: "matched", gameId: room.id });
      }
    }
    return res.status(200).json({ status: "waiting" });
  });

  app.get("/api/games/:gameId", (req: Request, res: Response) => {
    const room = gameRooms.get(req.params.gameId);
    if (!room) {
      return res.status(404).json({ message: "Game not found" });
    }
    return res.status(200).json({
      gameId: room.id,
      desiredPlayers: room.desiredPlayers,
      playerNames: room.playerNames,
      humanPlayerIds: room.humanPlayerIds,
      state: room.state,
    });
  });

  app.post("/api/history/vs-system", (req: Request, res: Response) => {
    void recordVsSystemHistory(req, res);
  });

  // ----- Room (friend lobby) APIs -----
  app.post("/api/rooms", async (req: Request, res: Response) => {
    const { userId, displayName } = req.body ?? {};
    if (!userId || !displayName) {
      return res.status(400).json({ message: "userId and displayName required" });
    }
    await ensureProfileExists(userId, displayName);
    let roomCode = generateRoomCode();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabaseServer.from("rooms").select("id").eq("room_code", roomCode).single();
      if (!existing) break;
      roomCode = generateRoomCode();
      attempts++;
    }
    const { data: room, error: roomErr } = await supabaseServer
      .from("rooms")
      .insert({
        room_code: roomCode,
        owner_id: userId,
        status: "waiting",
      })
      .select("id, room_code")
      .single();
    if (roomErr || !room) {
      // eslint-disable-next-line no-console
      console.error("Failed to create room (rooms insert)", roomErr);
      return res.status(500).json({ message: "Failed to create room" });
    }
    const { error: playerErr } = await supabaseServer.from("room_players").insert({
      room_id: room.id,
      user_id: userId,
      display_name: String(displayName).trim().slice(0, 50) || "Player",
      is_owner: true,
      is_ready: false,
    });
    if (playerErr) {
      await supabaseServer.from("rooms").delete().eq("id", room.id);
      // eslint-disable-next-line no-console
      console.error("Failed to create room (room_players insert)", playerErr);
      return res.status(500).json({ message: "Failed to add owner to room" });
    }
    res.status(200).json({ roomId: room.id, roomCode: room.room_code });
  });

  app.post("/api/rooms/join", async (req: Request, res: Response) => {
    const { roomCode, userId, displayName } = req.body ?? {};
    if (!roomCode || !userId || !displayName) {
      return res.status(400).json({ message: "roomCode, userId and displayName required" });
    }
    const room = await getRoomByCode(String(roomCode).toUpperCase());
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    if (room.status !== "waiting") {
      return res.status(400).json({ message: "Room is not waiting for players" });
    }
    const { count } = await supabaseServer
      .from("room_players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);
    if ((count ?? 0) >= 6) {
      return res.status(400).json({ message: "Room is full" });
    }
    const { data: existing } = await supabaseServer
      .from("room_players")
      .select("id")
      .eq("room_id", room.id)
      .eq("user_id", userId)
      .single();
    if (existing) {
      const lobby = await getRoomWithPlayers(room.id);
      return res.status(200).json({ roomId: room.id, roomCode: room.room_code, ...lobby });
    }
    await ensureProfileExists(userId, displayName);
    const { error } = await supabaseServer.from("room_players").insert({
      room_id: room.id,
      user_id: userId,
      display_name: String(displayName).trim().slice(0, 50) || "Player",
      is_owner: false,
      is_ready: false,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to join room (room_players insert)", error);
      return res.status(500).json({ message: "Failed to join room" });
    }
    const lobby = await getRoomWithPlayers(room.id);
    broadcastRoomUpdate(room.id, { type: "ROOM_UPDATE", ...lobby });
    res.status(200).json({ roomId: room.id, roomCode: room.room_code, ...lobby });
  });

  app.get("/api/rooms/:roomId", async (req: Request, res: Response) => {
    const lobby = await getRoomWithPlayers(req.params.roomId);
    if (!lobby) {
      return res.status(404).json({ message: "Room not found" });
    }
    res.status(200).json(lobby);
  });

  app.post("/api/rooms/:roomId/leave", async (req: Request, res: Response) => {
    const { roomId } = req.params;
    const { userId } = req.body ?? {};
    if (!userId) {
      return res.status(400).json({ message: "userId required" });
    }
    const lobby = await getRoomWithPlayers(roomId);
    if (!lobby) {
      return res.status(404).json({ message: "Room not found" });
    }
    const { data: me } = await supabaseServer
      .from("room_players")
      .select("is_owner")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();
    if (!me) {
      return res.status(200).json({ left: true });
    }
    await supabaseServer.from("room_players").delete().eq("room_id", roomId).eq("user_id", userId);
    const remaining = await supabaseServer.from("room_players").select("user_id, is_owner").eq("room_id", roomId);
    if (remaining.data?.length === 0) {
      await supabaseServer.from("rooms").delete().eq("id", roomId);
      roomLobbySockets.delete(roomId);
    } else if (me.is_owner) {
      const newOwner = remaining.data?.[0];
      if (newOwner) {
        await supabaseServer.from("room_players").update({ is_owner: true }).eq("room_id", roomId).eq("user_id", newOwner.user_id);
        await supabaseServer.from("rooms").update({ owner_id: newOwner.user_id, updated_at: new Date().toISOString() }).eq("id", roomId);
      }
    }
    const updated = await getRoomWithPlayers(roomId);
    if (updated) broadcastRoomUpdate(roomId, { type: "ROOM_UPDATE", ...updated });
    res.status(200).json({ left: true });
  });

  app.post("/api/rooms/:roomId/ready", async (req: Request, res: Response) => {
    const { roomId } = req.params;
    const { userId, isReady } = req.body ?? {};
    if (!userId) {
      return res.status(400).json({ message: "userId required" });
    }
    const { error } = await supabaseServer
      .from("room_players")
      .update({ is_ready: !!isReady })
      .eq("room_id", roomId)
      .eq("user_id", userId);
    if (error) {
      return res.status(500).json({ message: "Failed to set ready" });
    }
    const lobby = await getRoomWithPlayers(roomId);
    if (lobby) broadcastRoomUpdate(roomId, { type: "ROOM_UPDATE", ...lobby });
    res.status(200).json({ ready: !!isReady });
  });

  app.post("/api/rooms/:roomId/start", async (req: Request, res: Response) => {
    const { roomId } = req.params;
    const { userId } = req.body ?? {};
    if (!userId) {
      return res.status(400).json({ message: "userId required" });
    }
    const lobby = await getRoomWithPlayers(roomId);
    if (!lobby) {
      return res.status(404).json({ message: "Room not found" });
    }
    if (lobby.owner_id !== userId) {
      return res.status(403).json({ message: "Only the room owner can start the game" });
    }
    if (lobby.status !== "waiting") {
      return res.status(400).json({ message: "Game already started or finished" });
    }
    const players = lobby.players as { user_id: string; display_name: string; is_owner: boolean; is_ready: boolean; seat_index: number | null }[];
    if (players.length < 3) {
      return res.status(400).json({ message: "At least 3 players are required to start" });
    }
    const allNonOwnersReady = players
      .filter((p) => !p.is_owner)
      .every((p) => p.is_ready);
    if (!allNonOwnersReady) {
      return res.status(400).json({ message: "All players must be ready to start" });
    }
    const names = players.map((p) => p.display_name || "Player");
    const humanPlayerIds = players.map((p) => p.user_id);
    // Always start with seat 0 (the room owner) so they can play immediately
    const state = initGame(names, [], 0);
    const gameId = randomUUID();

    const room: GameRoom = {
      id: gameId,
      desiredPlayers: players.length,
      humanPlayerIds,
      playerNames: names,
      state,
      sockets: new Map(),
      createdAt: Date.now(),
      leftSeatIndices: new Set(),
    };
    gameRooms.set(gameId, room);

    await supabaseServer.from("games").insert({
      id: gameId,
      mode: "multiplayer_online",
      max_players: players.length,
      actual_players: players.length,
    });
    for (let i = 0; i < players.length; i++) {
      await supabaseServer.from("game_players").insert({
        game_id: gameId,
        user_id: players[i].user_id,
        display_name: players[i].display_name,
        player_type: "human",
        seat_index: i,
      });
    }
    for (let i = 0; i < players.length; i++) {
      await supabaseServer.from("room_players").update({ seat_index: i }).eq("room_id", roomId).eq("user_id", players[i].user_id);
    }
    await supabaseServer.from("rooms").update({
      status: "in_game",
      game_id: gameId,
      updated_at: new Date().toISOString(),
    }).eq("id", roomId);

    broadcastRoomUpdate(roomId, {
      type: "GAME_STARTED",
      gameId,
      state: room.state,
      playerNames: room.playerNames,
      humanPlayerIds: room.humanPlayerIds,
    });
    res.status(200).json({
      gameId,
      state: room.state,
      playerNames: room.playerNames,
      humanPlayerIds: room.humanPlayerIds,
    });
  });

  const httpServer = createServer(app);

  // Use noServer on both so we can manually route upgrades.
  // Attaching two WebSocketServers to the same httpServer with different paths causes
  // the first server to destroy sockets it doesn't own, blocking the second server.
  const wssRoom = new WebSocketServer({ noServer: true });
  // Room lobby WS: validate user is in room, then add to roomLobbySockets and broadcast ROOM_UPDATE
  wssRoom.on("connection", async (socket, request) => {
    const url = new URL(request.url ?? "", "http://localhost");
    const roomCode = url.searchParams.get("roomCode");
    const userId = url.searchParams.get("userId");
    if (!roomCode || !userId) {
      socket.close();
      return;
    }
    const room = await getRoomByCode(roomCode);
    if (!room) {
      socket.close();
      return;
    }
    const { data: member } = await supabaseServer
      .from("room_players")
      .select("id")
      .eq("room_id", room.id)
      .eq("user_id", userId)
      .single();
    if (!member) {
      socket.close();
      return;
    }
    if (!roomLobbySockets.has(room.id)) {
      roomLobbySockets.set(room.id, new Map());
    }
    roomLobbySockets.get(room.id)!.set(userId, socket);
    const lobby = await getRoomWithPlayers(room.id);
    if (lobby) broadcastRoomUpdate(room.id, { type: "ROOM_UPDATE", ...lobby });

    socket.on("close", () => {
      const m = roomLobbySockets.get(room.id);
      if (m) {
        m.delete(userId);
        if (m.size === 0) roomLobbySockets.delete(room.id);
      }
    });
  });

  const wss = new WebSocketServer({ noServer: true });

  // Manually route WebSocket upgrade events to the correct server based on URL path.
  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "", "http://localhost");
    const pathname = url.pathname;
    if (pathname === "/api/ws-room") {
      wssRoom.handleUpgrade(request, socket, head, (ws) => {
        wssRoom.emit("connection", ws, request);
      });
    } else if (pathname === "/api/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (socket, request) => {
    const url = new URL(request.url ?? "", "http://localhost");
    const gameId = url.searchParams.get("gameId");
    const playerId = url.searchParams.get("playerId");

    console.log(`[WS CONNECT] gameId=${gameId} playerId=${playerId}`);

    if (!gameId || !playerId) {
      console.warn("[WS CONNECT] rejected: missing gameId or playerId");
      socket.close();
      return;
    }

    const room = gameRooms.get(gameId);
    if (!room) {
      console.warn(`[WS CONNECT] rejected: room not found for gameId=${gameId}. Known rooms:`, [...gameRooms.keys()]);
      socket.close();
      return;
    }

    console.log(`[WS CONNECT] accepted: player ${playerId} joined game ${gameId}`);
    room.sockets.set(playerId, socket);

    socket.send(
      JSON.stringify({
        type: "STATE_INIT",
        gameId: room.id,
        state: room.state,
        leftSeatIndices: [...room.leftSeatIndices],
      })
    );

    socket.on("close", () => {
      console.log(`[WS DISCONNECT] player ${playerId} disconnected from game ${gameId}`);
      // Only delete if this specific socket is still the one registered (prevent a stale
      // close from a duplicate connection from wiping out the newer socket).
      if (room.sockets.get(playerId) === socket) {
        room.sockets.delete(playerId);
      }
    });

    socket.on("message", (data) => {
      try {
        const msg = JSON.parse(String(data)) as
          | { type: "THROW"; cardIds: string[] }
          | { type: "PICK_DECK" }
          | { type: "PICK_AVAILABLE"; cardId: string }
          | { type: "CALL_SHOW" }
          | { type: "NEXT_ROUND" }
          | { type: "PLAYER_LEFT" };

        // Handle PLAYER_LEFT separately — it doesn't mutate game state
        if (msg.type === "PLAYER_LEFT") {
          const seatIndex = room.humanPlayerIds.indexOf(playerId);
          const playerName = seatIndex >= 0 ? room.playerNames[seatIndex] : "A player";
          if (seatIndex >= 0) room.leftSeatIndices.add(seatIndex);
          const activeHumans = room.humanPlayerIds.length - room.leftSeatIndices.size;
          const notification = JSON.stringify({
            type: "PLAYER_LEFT",
            playerName,
            seatIndex,
            activeCount: activeHumans,
            totalCount: room.humanPlayerIds.length,
          });
          room.sockets.forEach((ws, id) => {
            if (id !== playerId && ws.readyState === WebSocket.OPEN) {
              ws.send(notification);
            }
          });
          // Remove this player's socket so they don't receive further updates
          room.sockets.delete(playerId);
          socket.close();
          return;
        }

        const current = room.state;
        let next: GameState | null = null;

        switch (msg.type) {
          case "THROW": {
            const cp = current.players[current.currentPlayerIndex];
            const handIds = cp?.hand?.map((c) => c.id) ?? [];
            const found = msg.cardIds?.every((id) => handIds.includes(id));
            console.log(`[WS THROW] player=${playerId} currentIdx=${current.currentPlayerIndex} phase=${current.phase} cardIds=${JSON.stringify(msg.cardIds)} foundInHand=${found}`);
            next = throwCards(current, msg.cardIds);
            console.log(`[WS THROW] result phase=${next.phase} handLen=${next.players[current.currentPlayerIndex]?.hand?.length}`);
            break;
          }
          case "PICK_DECK":
            console.log(`[WS PICK_DECK] player=${playerId} currentIdx=${current.currentPlayerIndex} phase=${current.phase}`);
            next = pickFromDeck(current);
            console.log(`[WS PICK_DECK] result phase=${next.phase} nextIdx=${next.currentPlayerIndex}`);
            break;
          case "PICK_AVAILABLE":
            console.log(`[WS PICK_AVAILABLE] player=${playerId} cardId=${msg.cardId} currentIdx=${current.currentPlayerIndex} phase=${current.phase}`);
            next = pickFromAvailable(current, msg.cardId);
            console.log(`[WS PICK_AVAILABLE] result phase=${next.phase} nextIdx=${next.currentPlayerIndex}`);
            break;
          case "CALL_SHOW":
            next = callShow(current);
            break;
          case "NEXT_ROUND":
            next = startNextRound(current);
            break;
        }

        if (!next) return;
        room.state = next;

        const payload = JSON.stringify({
          type: "STATE_UPDATE",
          gameId: room.id,
          state: room.state,
          leftSeatIndices: [...room.leftSeatIndices],
        });
        room.sockets.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
          }
        });

        const currentPlayer = room.state.players[room.state.currentPlayerIndex];
        if (currentPlayer.isBot) {
          const { finalState } = executeBotTurn(room.state);
          room.state = finalState;
          const botPayload = JSON.stringify({
            type: "STATE_UPDATE",
            gameId: room.id,
            state: room.state,
          });
          room.sockets.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(botPayload);
            }
          });
        }

        if (room.state.phase === "game_over") {
          // Persist final scores for human users
          room.state.players.forEach((player) => {
            const isBot = player.isBot;
            const profileId = isBot ? null : room.humanPlayerIds[room.state.players.indexOf(player)];
            if (!profileId) return;
            const pointsScored = player.score;
            const others = room.state.players.filter((p) => p.id !== player.id);
            const pointsAgainst = others.reduce((acc, p) => acc + p.score, 0);
            const didWin = room.state.winner?.id === player.id;
            supabaseServer
              .rpc("upsert_player_stats", {
                p_user_id: profileId,
                p_mode: "multiplayer_online",
                p_points_scored: pointsScored,
                p_points_against: pointsAgainst,
                p_did_win: didWin,
              })
              .then(({ error }) => {
                if (error) {
                  // eslint-disable-next-line no-console
                  console.error("Failed to upsert player stats", error);
                }
              });
          });
        }
      } catch {
        // ignore malformed messages
      }
    });
  });

  return httpServer;
}

