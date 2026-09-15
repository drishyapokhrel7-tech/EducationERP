-- CreateTable
CREATE TABLE "isbn_lookup_cache" (
    "isbn" TEXT NOT NULL,
    "title" TEXT,
    "author" TEXT,
    "publisher" TEXT,
    "coverImageUrl" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "isbn_lookup_cache_pkey" PRIMARY KEY ("isbn")
);
