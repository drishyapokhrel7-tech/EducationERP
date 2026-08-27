// Deliberately minimal — a PlatformAdmin has exactly one capability
// (view orgs, set editions), never touches tenant data, so there's no
// organizationId or permissions array to carry, unlike JwtPayload.
// `type: "platform"` is checked explicitly in PlatformJwtStrategy.validate
// as defense-in-depth beyond just "signed with the right secret".
export interface PlatformJwtPayload {
  sub: string;
  type: "platform";
}
