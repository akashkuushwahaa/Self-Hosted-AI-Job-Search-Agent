// Embeds jobs that have no embedding yet. The worker also does this daily, after ingest (lib/refresh.ts).
import { client } from "../db";
import { embedPending } from "../lib/embed-jobs";

const started = Date.now();
const done = await embedPending();
console.log(`done: ${done} jobs in ${((Date.now() - started) / 1000).toFixed(0)}s`);
await client.end();
