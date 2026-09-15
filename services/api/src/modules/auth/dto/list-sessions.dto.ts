import { IsOptional, IsString } from "class-validator";

export class ListSessionsDto {
  // Not used to authenticate this request (the access token already
  // does that) — only to mark which of the caller's own sessions is
  // the one they're currently on, by comparing its hash against each
  // session's stored refreshTokenHash. Optional: omit it and every
  // session just comes back with isCurrent: false.
  @IsOptional()
  @IsString()
  currentRefreshToken?: string;
}
