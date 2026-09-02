import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { ExpressAdapter } from "@nestjs/platform-express";
import helmet from "helmet";
import type { Express } from "express";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";

// Shared by both entry points: main.ts (persistent process — local
// dev, or any future non-serverless host) and api/index.ts (Vercel
// serverless function). Passing an existing Express instance lets the
// serverless entry wrap it with serverless-http; omitting it lets
// Nest create its own for app.listen().
export async function createApp(expressInstance?: Express): Promise<INestApplication> {
  const app = expressInstance
    ? await NestFactory.create(AppModule, new ExpressAdapter(expressInstance))
    : await NestFactory.create(AppModule);
  app.use(
    helmet({
      // This is a pure JSON API with no server-rendered HTML views, so
      // helmet's default CSP directives (meant for a page that loads
      // its own scripts/styles) don't apply here and are switched off
      // rather than left as directives nothing on this server ever
      // triggers.
      contentSecurityPolicy: false,
      // The local-disk storage driver (STORAGE_DRIVER=local,
      // local-files.controller.ts) serves uploaded files back from
      // this same API's own origin, which is a different origin than
      // the frontend (e.g. :4000 vs :3020) — helmet's default
      // same-origin Cross-Origin-Resource-Policy would silently break
      // every <img> tag pointed at a locally-stored photo/file.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  const corsOrigin = process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3020"];
  app.enableCors({ origin: corsOrigin, credentials: true });
  return app;
}
