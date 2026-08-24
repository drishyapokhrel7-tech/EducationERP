import { IsString } from "class-validator";

// The raw base64 `data` query param eSewa appends to success_url/failure_url.
export class ConfirmEsewaPaymentDto {
  @IsString()
  data!: string;
}
