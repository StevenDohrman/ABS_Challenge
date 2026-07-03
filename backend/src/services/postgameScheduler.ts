/**
 * Schedules postgame challenge audit when a game goes Final.
 * Uses MLB live feed pitchData — no Savant CSV delay.
 */

import { findGame } from "../db/gameRepository";
import { runPostgameAudit } from "./postgameAuditService";
import { enqueuePipelineDbWork } from "../db/pipelineDbQueue";

export function schedulePostgameAudit(gamePk: number): void {
  void enqueuePipelineDbWork(
    `postgame-audit game=${gamePk}`,
    async () => {
      const game = await findGame(gamePk);
      if (!game || game.postgameAuditedAt) return;
      if (game.status !== "Final") return;

      console.log(`[postgameScheduler] running postgame audit for game ${gamePk}`);
      await runPostgameAudit(gamePk);
    },
    "low"
  );
}

/** Resume audits for Final games that were not yet processed (e.g. after restart). */
export async function resumePendingPostgameAudits(): Promise<void> {
  const { prisma } = await import("../db/prisma");
  const pending = await prisma.game.findMany({
    where: {
      status: "Final",
      postgameAuditedAt: null,
    },
    select: { gamePk: true },
  });

  for (const game of pending) {
    console.log(
      `[postgameScheduler] resuming postgame audit for game ${game.gamePk}`
    );
    schedulePostgameAudit(game.gamePk);
  }
}
