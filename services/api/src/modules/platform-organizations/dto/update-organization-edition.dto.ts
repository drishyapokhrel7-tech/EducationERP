import { IsEnum } from "class-validator";
import { Edition } from "@prisma/client";

export class UpdateOrganizationEditionDto {
  @IsEnum(Edition)
  edition!: Edition;
}
