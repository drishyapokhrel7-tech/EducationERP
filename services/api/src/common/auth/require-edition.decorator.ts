import { SetMetadata } from "@nestjs/common";
import type { Edition } from "@prisma/client";

export const EDITION_KEY = "minEdition";

/**
 * Server-side counterpart to the frontend's FeatureLock/
 * FEATURE_MIN_EDITION (apps/web/src/lib/edition-features.ts) — the
 * same per-module minimum edition, enforced here too rather than only
 * in the UI. Applied at the controller class level (mirrors
 * @RequirePermissions' precedent of working at either class or method
 * level via Reflector.getAllAndOverride) since one dashboard page's
 * worth of routes shares one required edition, not a per-route split.
 */
export const RequireEdition = (edition: Edition) => SetMetadata(EDITION_KEY, edition);
