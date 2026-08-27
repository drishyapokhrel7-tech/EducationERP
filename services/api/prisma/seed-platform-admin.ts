/**
 * Bootstraps exactly one PlatformAdmin — the cross-org "application
 * super admin" who sets a school's licensing edition (Free/
 * Professional/Ultra). Deliberately the only way this table is ever
 * populated: there is no public self-registration endpoint for it,
 * unlike every tenant-scoped account this project seeds elsewhere.
 *
 * Idempotent: safe to re-run — updates the password/name if the email
 * already exists rather than erroring. Run with `pnpm run
 * platform:seed`. Reads PLATFORM_ADMIN_EMAIL/PLATFORM_ADMIN_PASSWORD
 * from the environment, falling back to a clearly-labeled local-dev
 * default so this works out of the box in this demo environment.
 */
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const EMAIL = process.env.PLATFORM_ADMIN_EMAIL ?? "platform-admin@ovexa.com";
const PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD ?? "PlatformDemoPass123!";
const NAME = process.env.PLATFORM_ADMIN_NAME ?? "Ovexa Platform Admin";

async function main() {
  const passwordHash = await argon2.hash(PASSWORD);
  const admin = await prisma.platformAdmin.upsert({
    where: { email: EMAIL },
    update: { passwordHash, name: NAME },
    create: { email: EMAIL, passwordHash, name: NAME },
  });
  // eslint-disable-next-line no-console
  console.log(`Platform admin ready: ${admin.email}`);
  if (!process.env.PLATFORM_ADMIN_PASSWORD) {
    // eslint-disable-next-line no-console
    console.log(`(using the local-dev default password — set PLATFORM_ADMIN_PASSWORD to change it)`);
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
