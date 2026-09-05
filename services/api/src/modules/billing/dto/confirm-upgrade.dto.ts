import { IsString } from "class-validator";

// The raw base64 `data` query param eSewa appends to success_url/
// failure_url — same shape as finance's ConfirmEsewaPaymentDto,
// duplicated rather than shared since these are two genuinely
// separate payment flows (see billing.service.ts's own class doc).
export class ConfirmUpgradeDto {
  @IsString()
  data!: string;
}
