// Pulls every curated board now. The worker also does this daily (lib/refresh.ts).
import { client } from "../db";
import { ingestAll } from "../lib/ingest";

const { boards, failed, added } = await ingestAll();
console.log(`done: ${boards - failed}/${boards} boards, ${added} new jobs`);
await client.end();
