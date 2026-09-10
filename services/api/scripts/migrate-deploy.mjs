#!/usr/bin/env node
// `prisma migrate deploy`, but resilient to this project's Neon
// endpoint being transiently slow/unreachable.
//
// It used to run raw in `vercel-build`, so a P1002 ("reached but
// timed out" acquiring the advisory lock) or P1001 during a Neon
// blip failed the whole deploy — even though migrations here are
// always applied ahead of time by hand and `migrate deploy` on
// Vercel is in practice a no-op.
//
// Behaviour:
//   - retry `migrate deploy` a few times with backoff
//   - if it still can't connect, check `migrate status`: schema
//     already up to date  -> exit 0 (nothing to do, don't block a
//     code-only deploy); genuinely pending + unappliable -> exit 1.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TRANSIENT = /P1001|P1002|P1008|P2024|advisory lock|reached but timed out|Can't reach database/i;

async function prisma(args) {
  return run("npx", ["prisma", ...args], { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 });
}

async function tryDeploy() {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const { stdout } = await prisma(["migrate", "deploy"]);
      process.stdout.write(stdout);
      return true;
    } catch (err) {
      const out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
      process.stdout.write(out);
      if (attempt === 4 || !TRANSIENT.test(out)) return false;
      const wait = 3000 * attempt;
      console.log(`\n[migrate-deploy] transient DB error, retrying in ${wait}ms (attempt ${attempt}/4)…\n`);
      await sleep(wait);
    }
  }
  return false;
}

if (await tryDeploy()) {
  process.exit(0);
}

// Couldn't apply. Only fail the build if there's actually something
// pending — a transient outage with nothing to do must not block a
// code deploy.
console.log("\n[migrate-deploy] deploy did not succeed; checking whether anything is actually pending…\n");
try {
  const { stdout } = await prisma(["migrate", "status"]);
  process.stdout.write(stdout);
  if (/up to date|No pending migrations/i.test(stdout)) {
    console.log("\n[migrate-deploy] schema is up to date — continuing the build.\n");
    process.exit(0);
  }
  console.error("\n[migrate-deploy] pending migrations that could not be applied — failing the build.\n");
  process.exit(1);
} catch (err) {
  const out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  process.stdout.write(out);
  if (TRANSIENT.test(out)) {
    console.error(
      "\n[migrate-deploy] cannot reach the database to even check migration status. " +
        "Assuming a transient outage and continuing — verify migrations manually if this deploy shipped schema changes.\n",
    );
    process.exit(0);
  }
  process.exit(1);
}
