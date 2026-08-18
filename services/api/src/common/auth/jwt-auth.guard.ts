import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Resolves the tenant (organizationId) and permission context from a
 * verified JWT only — never from a client-supplied header or body field.
 * This is the sole source of tenant scoping for every guarded route.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
