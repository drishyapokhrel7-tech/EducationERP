import { IsIn } from "class-validator";

// The mentor's own accept/decline response to a REQUESTED pairing.
export class RespondMentorshipDto {
  @IsIn(["ACTIVE", "DECLINED"])
  status!: "ACTIVE" | "DECLINED";
}
