import { IsDateString } from "class-validator";

// Only endDate is editable after creation — closing out a role once
// the alumnus moves on. Everything else about a past role is a fixed
// historical fact, same "immutable once created" precedent as most
// other history-style records in this project.
export class UpdateCareerHistoryDto {
  @IsDateString()
  endDate!: string;
}
