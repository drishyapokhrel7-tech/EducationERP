import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

// Mirrors JwtAuthGuard's shape exactly, but checks the "platform-jwt"
// strategy — a tenant-scoped token is rejected here just as a
// platform token is rejected by JwtAuthGuard (Passport strategies are
// independent; neither accepts the other's tokens).
@Injectable()
export class PlatformAuthGuard extends AuthGuard("platform-jwt") {}
