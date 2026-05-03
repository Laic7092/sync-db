import { createWSServer } from "sync-db";

const sync = createWSServer({ port: Number(process.env.SYNC_PORT) || 8765 });
await sync.start();
console.log(`\n  Open http://localhost:5173\n`);
