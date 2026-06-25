import { app } from "./app";
import { startOrchestrator } from "./orchestrator";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

async function main(): Promise<void> {
  // Start the live polling pipeline and daily Savant job.
  await startOrchestrator();

  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("[server] fatal startup error:", err);
  process.exit(1);
});
