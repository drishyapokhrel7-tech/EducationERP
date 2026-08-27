import { IsEnum, IsString, MinLength } from "class-validator";
import { HostelLookupKind } from "@prisma/client";

export class CreateLookupDto {
  @IsEnum(HostelLookupKind)
  kind!: HostelLookupKind;

  @IsString()
  @MinLength(1)
  name!: string;
}
