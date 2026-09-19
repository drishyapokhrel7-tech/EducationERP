import { IsDateString, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class ListSubstituteAssignmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;
}
