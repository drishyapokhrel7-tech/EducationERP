import express, { type Request, type Response } from "express";
import { createApp } from "../src/create-app";

// Vercel serverless entry. Nest boots once per cold-start (cached
// across warm invocations of the same function instance via the
// module-level promise below — not per-request), attached to a plain
// Express instance. An Express app is itself a valid Node
// (req, res) => void request handler — the same shape Vercel's
// Node.js runtime calls a serverless function's default export with
// — so it's exported directly, no Lambda-event adapter needed (that
// was the wrong shim: serverless-http translates to/from AWS
// Lambda's (event, context) contract, not Vercel's raw req/res one,
// and silently hung every request when used here). vercel.json
// rewrites every path to this function, so Nest's own routes (e.g.
// /auth/login) stay at their real paths instead of moving under /api.
let readyPromise: Promise<express.Express> | null = null;

async function bootstrap() {
  const server = express();
  const app = await createApp(server);
  await app.init();
  return server;
}

export default async function handler(req: Request, res: Response) {
  if (!readyPromise) {
    readyPromise = bootstrap();
  }
  const server = await readyPromise;
  server(req, res);
}
