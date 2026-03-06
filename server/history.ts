import type { Request, Response } from "express";
import { supabaseServer } from "./supabaseServer";

export async function recordVsSystemHistory(req: Request, res: Response) {
  const { userId, displayName, finalScore, didWin } = req.body ?? {};

  if (!userId || typeof finalScore !== "number") {
    return res.status(400).json({ message: "userId and finalScore are required" });
  }

  try {
    const gameId = `vs-${userId}-${Date.now().toString(36)}`;
    await supabaseServer.from("games").insert({
      id: gameId,
      mode: "vs_system",
      max_players: 4,
      actual_players: 4,
    });

    await supabaseServer.from("game_players").insert([
      {
        game_id: gameId,
        user_id: userId,
        display_name: displayName ?? "You",
        player_type: "human",
        is_bot: false,
        seat_index: 0,
        final_score: finalScore,
        is_winner: didWin ?? false,
      },
      {
        game_id: gameId,
        display_name: "Shadow",
        player_type: "bot",
        is_bot: true,
        seat_index: 1,
      },
    ]);

    const pointsAgainst = 0;

    await supabaseServer.rpc("upsert_player_stats", {
      p_user_id: userId,
      p_mode: "vs_system",
      p_points_scored: finalScore,
      p_points_against: pointsAgainst,
      p_did_win: didWin ?? false,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to record vs-system history", error);
    return res.status(500).json({ message: "Failed to record history" });
  }
}

