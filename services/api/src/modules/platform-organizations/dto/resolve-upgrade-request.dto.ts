import { IsNumber, IsOptional, IsPositive } from "class-validator";

// Optional — when the org has an active referredByPartnerId, this is
// the actual amount the admin received before resolving; when omitted,
// PlatformOrganizationsService.resolveUpgradeRequest falls back to
// EDITION_PRICING_NPR for the target edition.
export class ResolveUpgradeRequestDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  depositedAmount?: number;
}
