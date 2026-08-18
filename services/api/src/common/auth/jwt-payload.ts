export interface JwtPayload {
  sub: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
}
