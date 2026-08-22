import { Module } from "@nestjs/common";
import { BiometricPolicyService } from "./biometric-policy.service";
import { BiometricPolicyController } from "./biometric-policy.controller";

@Module({
  providers: [BiometricPolicyService],
  controllers: [BiometricPolicyController],
})
export class BiometricPolicyModule {}
