import { IsString, MinLength } from "class-validator";

// Shared by both teacher-portal and student-portal — a reply's shape
// doesn't depend on who's posting it, only which linked identity row
// (Employee vs Student) the service attaches server-side.
export class CreateDiscussionPostDto {
  @IsString()
  @MinLength(1)
  body!: string;
}
