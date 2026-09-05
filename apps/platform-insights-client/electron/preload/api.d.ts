import type { PlatformInsightsApi } from "./types";

declare global {
  interface Window {
    platformInsights: PlatformInsightsApi;
  }
}
