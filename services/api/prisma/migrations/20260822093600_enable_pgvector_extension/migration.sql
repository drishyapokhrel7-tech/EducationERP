-- pgvector was already installed on this project's real Neon database
-- out of band before this migration existed (confirmed via a direct
-- query while planning slice 6c: extversion 0.8.6, already present).
-- This migration formally tracks that fact in migration history so a
-- fresh database (or Prisma's shadow database, used by `migrate dev`
-- to validate new migrations) can replay the full history from empty
-- and still succeed once face_embeddings' vector(512) column is
-- created in the next migration.
CREATE EXTENSION IF NOT EXISTS vector;
