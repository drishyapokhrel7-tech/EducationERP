import express, { type Request, type Response } from "express";
import serverlessHttp from "serverless-http";
import { createApp } from "../src/create-app";

// Vercel serverless entry. Nest boots once per cold-start (cached
// across warm invocations of the same function instance via the
// module-level promise below — not per-request), wrapped in an
// Express instance that serverless-http adapts to the
// (req, res) => void shape Vercel's Node runtime expects. vercel.json
// rewrites every path here, so Nest's own routes (e.g. /auth/login)
// stay at their real paths instead of moving under /api.
let readyPromise: Promise<ReturnType<typeof serverlessHttp>> | null = null;

async function bootstrap() {
  const server = express();
  const app = await createApp(server);
  await app.init();
  return serverlessHttp(server);
}

export default async function handler(req: Request, res: Response) {
  if (!readyPromise) {
    readyPromise = bootstrap();
  }
  const proxy = await readyPromise;
  return proxy(req, res);
}
