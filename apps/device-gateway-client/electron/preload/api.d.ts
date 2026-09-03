import type { DeviceGatewayClientApi } from "./types";

declare global {
  interface Window {
    deviceGatewayClient: DeviceGatewayClientApi;
  }
}
