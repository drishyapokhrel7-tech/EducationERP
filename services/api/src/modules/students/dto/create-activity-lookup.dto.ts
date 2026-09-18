import { IsEnum, IsString, MinLength } from "class-validator";
import { ExtracurricularActivityLookupKind } from "@prisma/client";

export class CreateActivityLookupDto {
  @IsEnum(ExtracurricularActivityLookupKind)
  kind!: ExtracurricularActivityLookupKind;

  @IsString()
  @MinLength(1)
  name!: string;
}
