import { IsString, MinLength } from "class-validator";

export class CreateStaffDocumentDto {
  @IsString()
  employeeId!: string;

  @IsString()
  @MinLength(1)
  documentType!: string;

  @IsString()
  @MinLength(1)
  fileUrl!: string;
}
