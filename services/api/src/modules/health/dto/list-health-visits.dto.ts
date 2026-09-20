import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class ListHealthVisitsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  studentId?: string;
}
