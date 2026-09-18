import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class ListExtracurricularActivitiesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  studentId?: string;
}
