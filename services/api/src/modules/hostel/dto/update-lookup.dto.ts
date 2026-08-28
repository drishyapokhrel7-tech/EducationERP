import { IsOptional, IsString, MinLength } from "class-validator";

// `kind` is deliberately NOT included here — renaming the kind of an
// in-use lookup would be confusing (see hostel.controller.ts task
// notes); only the display `name` is editable after creation.
export class UpdateLookupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
