export interface HealthPingData {
  pingedAt: string;
}

export interface HealthPingResult {
  pong: true;
  pingedAt: string;
  processedAt: string;
}
