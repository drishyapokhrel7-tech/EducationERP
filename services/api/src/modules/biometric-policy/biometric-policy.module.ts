import { Module } from "@nestjs/common";
import { BiometricPolicyService } from "./biometric-policy.service";
import { BiometricPolicyController } from "./biometric-policy.controller";
import { AiGatewayModule } from "../ai-gateway/ai-gateway.module";

@Module({
  imports: [AiGatewayModule],
  providers: [BiometricPolicyService],
  controllers: [BiometricPolicyController],
})
export class BiometricPolicyModule {}
