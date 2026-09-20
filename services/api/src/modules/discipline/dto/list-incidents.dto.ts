import { IsEnum, IsOptional, IsString } from "class-validator";
import { DisciplineSeverity } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class ListIncidentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsEnum(DisciplineSeverity)
  severity?: DisciplineSeverity;
}
