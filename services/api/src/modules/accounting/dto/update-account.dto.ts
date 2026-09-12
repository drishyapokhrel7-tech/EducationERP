import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

// type and code are immutable once created — see Account's own schema
// comment — so this deliberately doesn't accept them, unlike
// CreateAccountDto.
export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
