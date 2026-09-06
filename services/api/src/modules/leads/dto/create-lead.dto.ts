import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

// The two current callers — website/site (ovexatechnology.com) and
// website/school (school.ovexa.com) — each pass their own literal
// "source" value; this isn't an open enum because a typo'd source
// from a third caller should be rejected, not silently accepted as a
// new category.
const SOURCES = ["site", "school"] as const;

export class CreateLeadDto {
  @IsIn(SOURCES)
  source!: (typeof SOURCES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;
}
