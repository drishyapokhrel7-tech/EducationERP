export interface JwtPayload {
  sub: string;
  organizationId: string;
  roles: string[];
  // No longer issued (the full list made the token exceed the default
  // HTTP header-size limit) — PermissionsGuard resolves permissions
  // from `roles` now. Still present on tokens issued before that
  // change, and honoured as a fallback until they expire.
  permissions?: string[];
}
