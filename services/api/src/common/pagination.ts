// Phase 8 performance-optimization slice — shared envelope for every
// paginated list endpoint, so the frontend gets one consistent shape
// to render "page X of Y" from, instead of each module inventing its
// own.
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Runs `findMany` and `count` concurrently and wraps the result in a
 * `PaginatedResult`. Callers pass their own `findMany`/`count` thunks
 * (already scoped to the right `where`/`orderBy`/`skip`/`take`) rather
 * than this helper trying to be a generic Prisma-model wrapper — each
 * module's query shape (includes, narrowed selects) stays exactly as
 * specific as it already was.
 */
export async function paginate<T>(
  findMany: () => Promise<T[]>,
  count: () => Promise<number>,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<T>> {
  const [data, total] = await Promise.all([findMany(), count()]);
  return { data, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
