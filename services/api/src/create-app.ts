import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { ExpressAdapter } from "@nestjs/platform-express";
import type { Express } from "express";
import { AppModule } from "./app.module";

// Shared by both entry points: main.ts (persistent process — local
// dev, or any future non-serverless host) and api/index.ts (Vercel
// serverless function). Passing an existing Express instance lets the
// serverless entry wrap it with serverless-http; omitting it lets
// Nest create its own for app.listen().
export async function createApp(expressInstance?: Express): Promise<INestApplication> {
  const app = expressInstance
    ? await NestFactory.create(AppModule, new ExpressAdapter(expressInstance))
    : await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  const corsOrigin = process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3020"];
  app.enableCors({ origin: corsOrigin, credentials: true });
  return app;
}
