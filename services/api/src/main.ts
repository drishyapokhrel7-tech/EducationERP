import { createApp } from "./create-app";

async function bootstrap() {
  const app = await createApp();
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  console.log(`API listening on :${port}`);
}

void bootstrap();
