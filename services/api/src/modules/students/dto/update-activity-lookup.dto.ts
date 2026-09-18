import { IsOptional, IsString, MinLength } from "class-validator";

// `kind` is deliberately NOT included — renaming the kind of an in-use
// lookup would be confusing; only the display `name` is editable after
// creation (same convention as hostel/dto/update-lookup.dto.ts).
export class UpdateActivityLookupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
